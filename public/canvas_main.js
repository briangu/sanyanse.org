//
// site.js
//
// the arbor.js website
//
(function($)
{
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
        var colors = ["black", "red", "green", "blue"]

        var _vignette = null
        var _mouseP = null;

        var that = {
            init:function(pSystem)
            {
                sys = pSystem
                sys.screen({size:{width:dom.width(), height:dom.height()}, padding:[36,60,36,60]})
                $(window).resize(that.resize)
                that.resize()
                that._initMouseHandling()
            },
            resize:function()
            {
                canvas.width = $(window).width()
                canvas.height = .75 * $(window).height()
                sys.screen({size:{width:canvas.width, height:canvas.height}})
                _vignette = null
                that.redraw()
            },
            redraw:function()
            {
                gfx.clear()
                sys.eachEdge(function(edge, p1, p2)
                             {
                                 if (edge.source.data.alpha * edge.target.data.alpha == 0) return
                                 gfx.line(p1, p2, {stroke:"#b2b19d", width:2, alpha:edge.target.data.alpha})
                             })
                sys.eachNode(function(node, pt)
                             {
                                 var w = Math.max(20, 20 + gfx.textWidth(node.name))
                                // if (node.data.alpha === 0) return
                                 if (node.data.shape == 'rect')
                                 {
                                     gfx.rect(pt.x - w / 2, pt.y - 8, w, 20, 4,
                                              {fill:colors[node.data.color], alpha:node.data.alpha})
                                     gfx.text(node.name, pt.x, pt.y + 9,
                                              {color:"white", align:"center", font:"Arial", size:12})
                                     gfx.text(node.name, pt.x, pt.y + 9,
                                              {color:"white", align:"center", font:"Arial", size:12})
                                 }
                                 else
                                 {
                                     gfx.oval(pt.x - w / 2, pt.y - w / 2, w, w,
                                              {fill:colors[node.data.color], alpha:node.data.alpha})
                                     gfx.text(node.name, pt.x, pt.y + 7,
                                              {color:"white", align:"center", font:"Arial", size:12})
                                     gfx.text(node.name, pt.x, pt.y + 7,
                                              {color:"white", align:"center", font:"Arial", size:12})
                                 }
                             })
                that._drawVignette()
            },

            _drawVignette:function()
            {
                var w = canvas.width
                var h = canvas.height
                var r = 20

                if (!_vignette)
                {
                    var top = ctx.createLinearGradient(0, 0, 0, r)
                    top.addColorStop(0, "#e0e0e0")
                    top.addColorStop(.7, "rgba(255,255,255,0)")

                    var bot = ctx.createLinearGradient(0, h - r, 0, h)
                    bot.addColorStop(0, "rgba(255,255,255,0)")
                    bot.addColorStop(1, "white")

                    _vignette = {top:top, bot:bot}
                }

                // top
                ctx.fillStyle = _vignette.top
                ctx.fillRect(0, 0, w, r)

                // bot
                ctx.fillStyle = _vignette.bot
                ctx.fillRect(0, h - r, w, r)
            },

            switchMode:function(e)
            {
                if (e.mode == 'hidden')
                {
                    dom.stop(true).fadeTo(e.dt, 0, function()
                    {
                        if (sys) sys.stop()
                        $(this).hide()
                    })
                } else if (e.mode == 'visible')
                {
                    dom.stop(true).css('opacity', 0).show().fadeTo(e.dt, 1, function()
                    {
                        that.resize()
                    })
                    if (sys) sys.start()
                }
            },

            switchSection:function(newSection)
            {
                var parent = sys.getEdgesFrom(newSection)[0].source
                var children = $.map(sys.getEdgesFrom(newSection), function(edge)
                {
                    return edge.target
                })

                sys.eachNode(function(node)
                             {
                                 if (node.data.shape == 'dot') return // skip all but leafnodes

                                 var nowVisible = ($.inArray(node, children) >= 0)
                                 var newAlpha = (nowVisible) ? 1 : 0
                                 var dt = (nowVisible) ? .5 : .5
                                 sys.tweenNode(node, dt, {alpha:newAlpha})

                                 if (newAlpha == 1)
                                 {
                                     node.p.x = parent.p.x + .05 * Math.random() - .025
                                     node.p.y = parent.p.y + .05 * Math.random() - .025
                                     node.tempMass = .001
                                 }
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
                                dragged.node.data.color = (dragged.node.data.color + 1) % 4
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
                          var sys = arbor.ParticleSystem(50, 12, 0.24, true, 55, 0.02, 0.4) // create the system with sensible repulsion/stiffness/friction
                          sys.renderer = Renderer("#sitemap")

                          // load the data into the particle system as is (since it's already formatted correctly for .grafting)
                          var data = $.getJSON("g/n.json?p=0.30&count=16", function(data)
                          {
                            $.each(data.nodes, function(key, value) {
//                                value.color = 0;
                                value.alpha = 1.0;
                            });

                              sys.graft({nodes:data.nodes, edges:data.edges})

			      sys.eachNode(function(node, pt)
                              {
                                node.tempMass =  Math.random() * 100
                              })
                          })
                      })

})(this.jQuery)
