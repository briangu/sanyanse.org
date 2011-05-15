//
// site.js
//
// the arbor.js website
//
(function($)
{
    var after = 0;
    var tid = -1;
    var bltid = -1;
    var pollInterval = 2000;

    var fetchCount = 100;

    var updateMap = {};
    var industryMap = {};
    var readyQueue = new Array();
    var backlogQueue = new Array();
    var backlogMap = {};
    var sys;
    var nodeCount = 0;
    var maxNodes = 20;

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
        if (readyQueue.length <= 1)
        {
            if (fetchCount > 0)
            {
                // only scan our 1st degree network looking for new articles
                var params = {facet:"network,0,1", facets:"industry", count: fetchCount};
                IN.API.Raw("/signal-search:(offset,facets,updates,num-results)").params(params).result(processFetchResults).error(displayNetworkUpdatesError);
                fetchCount = 0;
            }
            else
            {
                // only scan our 1st degree network looking for new articles
//            var params = {facet:"network,0,1", facets:"industry", after: after, poll:"true"};
//            IN.API.Raw("/signal-search:(offset,facets,updates,num-results)").params(params).result(processPollCountFetchResults).error(displayNetworkUpdatesError);
            }
        }

        if (readyQueue.length > 0 && nodeCount < maxNodes)
        {
            var added;
            do {
                var update = readyQueue.pop();
                added = addUpdate(update);
            }
            while (!added && readyQueue.length > 0);
        }

        clearTimeout(tid);
        tid = setTimeout(onPollTimeout, pollInterval)
    }

    var onBacklogTimeout = function()
    {
        while (backlogQueue.length > 0)
        {
            var query = backlogQueue.pop();
            backlogMap[query] = undefined;

            trace('bl query: ' + query);

            // scan 0,1,2 degree networks to include attributions
            var params = {facet:"network,0,1", facets:"industry", count:10, keywords: query};
            IN.API.Raw("/signal-search").params(params).result(processBacklogFetchResults).error(displayNetworkUpdatesError);
        }

        clearTimeout(bltid);
        bltid = setTimeout(onBacklogTimeout, 2000)
    }

    var processPollCountFetchResults = function(result)
    {
        if (result.numResults == undefined || result.numResults == 0) return;

        fetchCount = result.numResults;
    }

    var processFetchResults = function(result)
    {
        if (result.updates == undefined || result.updates.values == undefined || result.updates.values.length == 0) return;

        var updates = result.updates;
        after = updates.values[0].timestamp;

        if (updates.values.length == 0) return;

        for (var idx in updates.values)
        {
            var update = updates.values[idx];
            trace("poll update: " + update.updateKey);
            if (update.updateContent == undefined)
            {
                continue;
            }
            person = update.updateContent.person
            if (person.currentShare == undefined)
            {
                continue;
            }
            var share = person.currentShare;
            if (updateMap[update.updateKey] != undefined)
            {
                continue; // hit an update we have already seen
            }

            personKey = person.firstName + " " + person.lastName;
            if (backlogMap[personKey] != undefined) continue;

            backlogQueue.unshift(personKey);
            backlogMap[personKey] = "";
        }
    }

    var processBacklogFetchResults = function(result)
    {
        if (result.updates == undefined || result.updates.values == undefined || result.updates.values.length == 0) return;

        var updates = result.updates;

        for (var idx in updates.values)
        {
            var update = updates.values[idx];
            trace("bl update: " + update.updateKey);
            if (update.updateContent == undefined) continue;
            person = update.updateContent.person
            if (person.currentShare == undefined) continue;
            var share = person.currentShare;
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
    }

    var addUpdate = function(update)
    {
        var person = update.updateContent.person
        var share = person.currentShare;

        var data = {}
        data.color = 0;
        data.text = share.content.title;
        data.mass = 1; // default is 1
//        data.x
//        data.y
        sys.addNode(update.updateKey, data);
        sys.addEdge(update.updateKey, "0", {});
//        sys.addEdge("0", update.updateKey, {});

// add edges by walking industryMap
        facets = updateMap[update.updateKey]["facets"];
        trace("update edges: " + update.updateKey);
        $.each(facets, function(index, value)
        {
            trace(value.code);
            if (industryMap[value.code] != undefined)
            {
                // a node already exists that shares the same industry
                $.each(industryMap[value.code], function(i2, v2)
                {
                    trace("  connects to: " + v2.updateKey);
                    sys.addEdge(update.updateKey, v2.updateKey, {});
                    sys.addEdge(v2.updateKey, update.updateKey, {});
                });
            }
            else
            {
                industryMap[value.code] = new Array();
            }
            // newNode = sys.addNode(...);
            // industryMap[value.code].push(newNode);

            // tmp hack to track graph during development
            industryMap[value.code].push(update);
        });

        var updateHtml = "<div id='" + share.id + "' class=streamitem>";

// Person's picture,  linked name, and status
        /*
         updateHtml += "<div class=updateperson>" ;
         updateHtml += "<img class=img_border align=\"left\" height=\"50\" src=\"" + person.pictureUrl + "\"></a>";
         if (person.publicProfileUrl != undefined) {
         updateHtml += "<a href=\"" + person.publicProfileUrl + "\">";
         updateHtml += "<span class=updater>" + person.firstName + " " + person.lastName + "</span>";
         updateHtml += "</a>";
         } else {
         updateHtml += "<span class=updater>" + person.firstName + " " + person.lastName + "</span>";
         }
         updateHtml += "</div>";
         */
        if (share.comment != undefined)
        {
//      updateHtml += "<p class=update>" + share.comment + "</p>";
        }
        if (share.content != undefined)
        {
            /*
             description: "Facebook has admitted that it has authorized an effort to raise privacy concerns about a Google product. But why do so in the first place?"
             eyebrowUrl: "http://www.linkedin.com/share?viewLink=&sid=s384308659&url=http%3A%2F%2Flnkd%2Ein%2F8PAND6&urlhash=bvRj&uid=5474990238310858752"
             shortenedUrl: "http://lnkd.in/8PAND6"
             submittedImageUrl: "http://5.mshcdn.com/wp-content/uploads/2011/03/facebook-like-dislike-360.jpg"
             submittedUrl: "http://mashable.com/2011/05/12/facebook-google-smear-campaign/?utm_source=feedburner&utm_medium=feed&utm_campaign=Feed%3A+Mashable+%28Mashable%29"
             thumbnailUrl: "https://www.linkedin.com/media-proxy/ext?w=80&h=100&hash=F%2Bk1dscV2yElKu1Wcluu1m1XUIk%3D&url=http%3A%2F%2F5.mshcdn.com%2Fwp-content%2Fuploads%2F2011%2F03%2Ffacebook-like-dislike-360.jpg"
             title: "In Trying to Plant Google Privacy Story, Did Facebook Have a Point?"
             */
            updateHtml += "<div>";
            updateHtml += "<img src=\"" + share.content.thumbnailUrl + "\"/>";
//      updateHtml += "<div>" + share.content.description + "</div>";
            updateHtml += "<a target='_blank' href=\"" + share.content.eyebrowUrl + "\">" + share.content.title + "</a>";
            updateHtml += "</div>";
        }

        updateHtml += "</div>";

        $("#networkupdates").append(updateHtml);

        nodeCount++;

        return true
    }

    var displayNetworkUpdatesError = function(error)
    { /* do nothing */
    }

    var trace = function(msg){
       if (typeof(window)=='undefined' || !window.console) return
       var len = arguments.length, args = [];
       for (var i=0; i<len; i++) args.push("arguments["+i+"]")
       eval("console.log("+args.join(",")+")")
     }

    var Renderer = function(elt)
    {
        var dom = $(elt)
        var canvas = dom.get(0)
        var ctx = canvas.getContext("2d");
        var gfx = arbor.Graphics(canvas)
        var sys = null
        var colors = ["#EEEEEE", "#7F7F7F", "#EEEEEE", "#EEEEEE"]

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
                                 gfx.line(p1, p2, {stroke:"#EEEEEE", width:1, alpha:edge.target.data.alpha})
                             })
                sys.eachNode(function(node, pt)
                             {
                                 if (node.data.text == undefined) return;
                                 var w = Math.min(80, 100 + gfx.textWidth(node.data.text))
                                 var h = 80;
                                 gfx.rect(pt.x - w / 2, pt.y - 8, w, h, 4,
                                          {fill:colors[node.data.color], alpha:node.data.alpha})
                                 gfx.text(node.data.text, pt.x, pt.y + 9,
                                          {color:"black", align:"center", font:"Arial", size:12})
                                 gfx.text(node.data.text, pt.x, pt.y + 9,
                                          {color:"black", align:"center", font:"Arial", size:12})
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
//                                dragged.node.data.color = (dragged.node.data.color + 1) % 4
                                sys.pruneNode(dragged.node);
                                updateMap[node.name] = undefined;
                                // TODO: prune industryMap
                                // does this remove all the edges too?
                                nodeCount--;
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

    $(document).ready(function()
                      {
                          sys = arbor.ParticleSystem(500, 120, 0.24, true, 55, 0.005, 0.4) // create the system with sensible repulsion/stiffness/friction
//                          sys = arbor.ParticleSystem();
//                          sys.parameters({stiffness:500, repulsion:50, gravity:true, dt:0.005});
                          sys.renderer = Renderer("#sitemap")

                          // load the data into the particle system as is (since it's already formatted correctly for .grafting)
                          var data = $.getJSON("g/n.json?p=0.30&count=0", function(data)
                          {
                            $.each(data.nodes, function(key, value) {
//                                value.color = 0;
                                value.alpha = 1.0;
                            });

                            sys.graft({nodes:data.nodes, edges:data.edges})
                          });

                          onLinkedInLoad();
                      })

})(this.jQuery)


