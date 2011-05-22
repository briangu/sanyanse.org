//
// site.js
//
// the arbor.js website
//
(function($)
{
  var sys;

  var after = 0;
  var tid = -1;
  var bltid = -1;
  var maxPollInterval = 20000;
  var normalPollInterval = 250;
  var pollInterval = 10;

  var fetchCount = 100;

  var divMap = {};
  var updateMap = {};
  var facetMap = {};
  facetMap["industry"] = {};
  facetMap["company"] = {};

  var visitedMap = {};

  var readyQueue = new Array();
  var backlogQueue = new Array();
  var backlogMap = {};
  var nodeCount = 0;
  var maxNodes = 12;
  var outstandingPalRequests = 0;
  var maxPalRequests = 1;
  var maxColors = 4;

  defaultImgUrl = "http://static01.linkedin.com/scds/common/u/img/bg/bg_newspaper_104x96.png";

  colorIdx = 0;
  colorMap = {};

  if (!Array.prototype.shuffle)
  {
    Array.prototype.shuffle = function()
    {
      if (this.length < 2) return this;

      var result = this.concat();
      var arr = this;
      for (var i = 0; i < result.length; i++)
      {
        var j = i;
        while (j == i)
        {
          j = Math.floor(Math.random() * result.length);
        }
        var contents = result[i];
        result[i] = arr[j];
        result[j] = contents;
      }

      return result;
    };
  }

  var onLinkedInLoad = function()
  {
    IN.Event.on(IN, "auth", onLinkedInAuth);
  }

  var onLinkedInAuth = function()
  {
    trace("authed..starting up");
    tid = setTimeout(onPollTimeout, 10);
    bltid = setTimeout(onBacklogTimeout, 100);
  }

  var onPollTimeout = function()
  {
    var didSomething = false;

    trace("outstandingPalRequests: " + outstandingPalRequests);

    if ((outstandingPalRequests < maxPalRequests) && (readyQueue.length <= 1 || fetchCount > 0))
    {
      if (fetchCount > 0)
      {
        // only scan our 1st degree network looking for new articles
        var params = {facet:"network,0,1", facets:"industry,company", count: fetchCount};
        IN.API.Raw("/signal-search:(offset,facets,updates,num-results)").params(params).result(processFetchResults).error(displayNetworkUpdatesError);
        fetchCount = 0;
        outstandingPalRequests++;
      }
      else
      {
//        var params = {facet:"network,0,1", facets:"industry,company", after: after, poll:"true"};
//        IN.API.Raw("/signal-search:(offset,facets,updates,num-results)").params(params).result(processPollCountFetchResults).error(displayNetworkUpdatesError);
      }
      didSomething = true;
    }

    if (readyQueue.length > 0 && nodeCount < maxNodes)
    {
      var added;
      do {
        var update = readyQueue.pop();
        added = addUpdate(update);
      }
      while (!added && readyQueue.length > 0);
      didSomething = true;
    }

    pollInterval = didSomething ? normalPollInterval : Math.min(pollInterval * 2, maxPollInterval);

    trace("pollinterval: " + pollInterval);

    resetPollTimer(pollInterval);
  }

  var resetPollTimer = function(val) {
    pollInterval = val;
    clearTimeout(tid);
    tid = setTimeout(onPollTimeout, val)
  }

  var onBacklogTimeout = function()
  {
    trace("outstandingPalRequests: " + outstandingPalRequests);
    trace("backlogQueue.length: " + backlogQueue.length);
    trace("backlogQueue.length: " + backlogQueue.length);

    while ((outstandingPalRequests < maxPalRequests) && (backlogQueue.length > 0 && (nodeCount < maxNodes)))
    {
      var query = backlogQueue.pop();
      backlogMap[query] = undefined;

      trace('bl query: ' + query);

      // scan 0,1,2 degree networks to include attributions
      var params = {facet:"network,0,1", facets:"industry", count:10, keywords: query};
      IN.API.Raw("/signal-search").params(params).result(processBacklogFetchResults).error(displayNetworkUpdatesError);
      outstandingPalRequests++;
    }

    clearTimeout(bltid);
    bltid = setTimeout(onBacklogTimeout, 250);
  }

  var processPollCountFetchResults = function(result)
  {
    outstandingPalRequests--;

    if (result.numResults == undefined || result.numResults == 0) return;
    // just store the count and we'll fetch it on poll
    fetchCount = result.numResults;
  }

  var processFetchResults = function(result)
  {
    outstandingPalRequests--;

    if (result.updates == undefined || result.updates.values == undefined || result.updates.values.length == 0) return;

    var updates = result.updates;
    after = updates.values[0].timestamp;

    if (updates.values.length == 0) return;

    for (var idx in updates.values)
    {
      var update = updates.values[idx];
      trace("poll update: " + update.updateKey);
      if (update.updateContent == undefined) continue;
      person = update.updateContent.person
      if (person.currentShare == undefined) continue;
      var share = person.currentShare;
      if (updateMap[update.updateKey] != undefined) continue;

      personKey = person.firstName + " " + person.lastName;
      if (backlogMap[personKey] != undefined) continue;

      backlogQueue.push(personKey);
      backlogMap[personKey] = "";
    }
  }

  var processBacklogFetchResults = function(result)
  {
    outstandingPalRequests--;

    if (result.updates == undefined || result.updates.values == undefined || result.updates.values.length == 0) return;

    var updates = result.updates;

    for (var idx in updates.values)
    {
      var update = updates.values[idx];
      if (update == undefined) continue;
      trace("bl update: " + update.updateKey);
      if (update.updateKey == undefined) continue;
      if (update.updateContent == undefined) continue;
      person = update.updateContent.person
      if (person.currentShare == undefined) continue;
      if (updateMap[update.updateKey] != undefined) continue;

      // the items we are receiving are getting older, so put them at the end to make a LIFO
      readyQueue.push(update);
      facets = result.facets.values[0].buckets.values;
      $.each(facets, function(index, value)
      {
        trace(value.code);
      });
      updateMap[update.updateKey] = {update:update, facets:facets};

      // http://www.linkedin.com/cws/share-count?url=http://www.cnn.com
    }

    readyQueue.shuffle(); // prevents one user's updates from dominating at the expense of chrono ordering
  }

  var addUpdate = function(update)
  {
    var person = update.updateContent.person
    var share = person.currentShare;

    if (share.content == undefined)
    {
      trace("article missing content: " + share.id);
      return;
    }

    imgUrl = share.content.thumbnailUrl == undefined
               ? defaultImgUrl
               : share.content.thumbnailUrl;

    if (share.content.submittedUrl != undefined) {
      if (visitedMap[share.content.submittedUrl] != undefined) return false;
      visitedMap[share.content.submittedUrl] = true;
    }

    var data = {color: -1, url: share.content.eyebrowUrl, img: imgUrl, text: share.content.title};

    sys.addNode(update.updateKey, data);
    sys.addEdge(update.updateKey, "0", {});

    facets = updateMap[update.updateKey]["facets"];
    trace("update edges: " + update.updateKey);

    $.each(facets, function(index, value)
    {
      if (data.color == -1) {
        if (colorMap[value.code] == undefined)
        {
          colorMap[value.code] = colorIdx;
          colorIdx = (colorIdx + 1) % maxColors;
        }
        data.color = colorMap[value.code];
      }

      trace(value.code);

      if (facetMap[value.code] != undefined)
      {
        // a node already exists that shares the same industry
        $.each(facetMap[value.code], function(i2, v2)
        {
          trace("  connects to: " + v2.updateKey);
          sys.addEdge(update.updateKey, v2.updateKey, {});
          sys.addEdge(v2.updateKey, update.updateKey, {});
        });
      }
      else
      {
        facetMap[value.code] = new Array();
      }

      facetMap[value.code].push(update);

      return false; // only allow one facet value for now
    });

    if (data.color == -1) data.color = 0;

    nodeCount++;

    return true
  }

  var displayNetworkUpdatesError = function(error)
  { /* do nothing */
  }

  var trace = function(msg)
  {
    if (typeof(window) == 'undefined' || !window.console) return
    var len = arguments.length, args = [];
    for (var i = 0; i < len; i++) args.push("arguments[" + i + "]")
    eval("console.log(" + args.join(",") + ")")
  }

  var Renderer = function(elt)
  {
    var dom = $(elt)
    var canvas = dom.get(0)
    var ctx = canvas.getContext("2d");
    var gfx = arbor.Graphics(canvas)
    var sys = null

    var _mouseP = null;

    var that = {
      init:function(pSystem)
      {
        sys = pSystem
        sys.screen({size:{width:dom.width(), height:dom.height()}, padding:[100,100,100,100]})
        $(window).resize(that.resize)
        that.resize()
        that._initMouseHandling()
      },
      resize:function()
      {
        canvas.width = $(window).width()
        canvas.height = $(window).height()
        sys.screen({size:{width:canvas.width, height:canvas.height}})
        that.redraw()
      },
      redraw:function()
      {
        gfx.clear()
        sys.eachEdge(function(edge, p1, p2)
                     {
                       if (edge.source.data.alpha * edge.target.data.alpha == 0) return
                       gfx.line(p1, p2, {stroke:"#1a82f7", width:1, alpha:edge.target.data.alpha})
                     })
        sys.eachNode(function(node, pt)
                     {
                       if (node.data.text == undefined) return;
                       if (divMap[node.name] == undefined)
                       {
                         var id = "div_" + node.name;
                         var imgTag;
                         if (node.data.img == defaultImgUrl) {
                           imgTag = "<img class='updateimg' width='80px' src='" + node.data.img + "'/>";
                         }
                         else
                         {
                           imgTag = "<img class='updateimg' src='" + node.data.img + "'/>";
                         }
                         var textTag = "<p class='updatep'>" + node.data.text + "</p>";
                         var closeTag = "<img id='img_"+id+"' class='closeTag' src='close-cross.jpg'/>"
                         var div = jQuery('<div/>', {
                           id: id,
                           class: "update" + node.data.color,
                           html: imgTag + textTag + closeTag,
                           mouseover: function() {
                             $('#img_'+id).css('visibility', 'visible');
                           },
                           mouseout: function() {
                             $('#img_'+id).css('visibility', 'hidden');
                           },
                           click: function(e)
                           {
                             if (e.target.id == "img_"+id) {
                               deleteNode(node);
                             } else {
                               window.open(node.data.url);
                             }
                           }
                         });
                         div.appendTo('#networkupdates');
                         $('#' + id).corner();
                         divMap[node.name] = $('#' + id);
                       }
                       divMap[node.name].offset({ top:  pt.y - 8, left: pt.x - 225 / 2 });
                     })
      },

      _initMouseHandling:function()
      {
        // no-nonsense drag and drop (thanks springy.js)
        var dragged = null;

        // set up a handler object that will initially listen for mousedowns then
        // for moves and mouseups while dragging
        var handler = {
          clicked:function(e)
          {
            var pos = $(canvas).offset();
            _mouseP = arbor.Point(e.pageX - pos.left, e.pageY - pos.top)
            dragged = sys.nearest(_mouseP);

            if (dragged && dragged.node !== null)
            {
              // while we're dragging, don't let physics move the node
              dragged.node.fixed = true
              dragged.node.data.moved = false
            }

            $(canvas).bind('mousemove', handler.dragged)
            $(window).bind('mouseup', handler.dropped)

            return false
          },
          dragged:function(e)
          {
            var pos = $(canvas).offset();
            var s = arbor.Point(e.pageX - pos.left, e.pageY - pos.top)

            if (dragged && dragged.node !== null)
            {
              var p = sys.fromScreen(s)
              dragged.node.p = p
              dragged.node.data.moved = true
            }

            return false
          },

          dropped:function(e)
          {
            if (dragged === null || dragged.node === undefined) return
            if (dragged.node !== null)
            {
              dragged.node.fixed = false
              if (!dragged.node.data.moved)
              {
                deleteNode(dragged.node);
              }
            }
            dragged.node.tempMass = 1000
            dragged = null
            $(canvas).unbind('mousemove', handler.dragged)
            $(window).unbind('mouseup', handler.dropped)
            _mouseP = null
            return false
          }
        }

        // start listening
        $(canvas).mousedown(handler.clicked);

      }
    }

    return that
  }

  var deleteNode = function(node)
  {
    var edges = sys.getEdgesFrom(node);
    $.each(edges, function(index, value)
    {
      sys.pruneEdge(value);
    });
    var edges = sys.getEdgesTo(node);
    $.each(edges, function(index, value)
    {
      sys.pruneEdge(value);
    });
    $.each(facetMap, function(key, value)
    {
      var tmpArray = new Array();
      $.each(value, function(i2, v2)
      {
        if (v2.updateKey != node.name)
        {
          tmpArray.push(v2);
        }
      });
      facetMap[key] = tmpArray;
    });

    divMap[node.name].remove();
    divMap[node.name] = undefined;

    sys.pruneNode(node);
    updateMap[node.name] = undefined;
    // TODO: prune industryMap
    // does this remove all the edges too?
    nodeCount--;
    resetPollTimer(10);
  }

  $(document).ready(function()
                    {
                      sys = arbor.ParticleSystem(700, 120, 0.24, true, 55, 0.005, 0.4) // create the system with sensible repulsion/stiffness/friction
//                          sys = arbor.ParticleSystem();
//                          sys.parameters({stiffness:500, repulsion:50, gravity:true, dt:0.005});
                      sys.renderer = Renderer("#sitemap")

                      // load the data into the particle system as is (since it's already formatted correctly for .grafting)
                      var data = $.getJSON("g/n.json?p=0.30&count=0", function(data)
                      {
                        $.each(data.nodes, function(key, value)
                        {
//                                value.color = 0;
                          value.alpha = 1.0;
                        });

                        sys.graft({nodes:data.nodes, edges:data.edges})
                      });

                      onLinkedInLoad();
                    })

})(this.jQuery)


