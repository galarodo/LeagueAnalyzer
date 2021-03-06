var n = 5, // number of layers
    m = 50, // number of samples per layer
    datagen = stream_layers,
    raw_data0 = null, //datagen(n, m),
    raw_data1 = null,
    w = 960,
    h = 200,
    top_height = 40, /* WARNING: can't use the name 'top' here as that will break in Chrome20, which has that naem reserved for an internal, non-overridable function! So we name this one top_height */
    mx = m - 1; //datagen(n, m);

datagen();
function takeData(data) {
    raw_data0 = data;
    raw_data1 = data;

    var stack = d3.layout.stack()
        .offset("wiggle")
        .values(function(d) { return d.values; })
        .x(function(d) { return d.time; })
        .y(function(d) { return d.actions; });

    var data0 = d3.layout.stack().offset("wiggle")(raw_data0),
        data1 = d3.layout.stack().offset("wiggle")(raw_data1),
        tags,
        color = d3.interpolateRgb("#aad", "#556"),
        strip_toggled = [];

    var my = d3.max(data0.concat(data1), function (d) {
            return d3.max(d, function (d) {
                return d.y0 + d.y;
            });
        }),
// convert values to pixels:
        y = function (v) {
            return v * (h - top_height) / my;
        },
        x = function (v) {
            return v * w / mx;
        };

    var area = d3.svg.area()
        .x(function (d) {
            return x(d.x);
        })
        .y0(function (d) {
            return h - y(d.y0);
        })
        .y1(function (d) {
            return h - y(d.y + d.y0);
        })
        .interpolate('linear');

    var graph = d3.select("#chart")
        .append("svg")
        .attr("width", w)
        .attr("height", h);

    var header = graph
        .append("g")
        .attr("class", "topside")
        .style("visibility", "hidden"); // flicker fix for the d3.timer+getBBox further below.

// print the tags at the top:
    var topside_sel = header.selectAll("g")
        .data(tags = names_gen(n))   // w and h are used by names_gen() but are not defined at the time tags var is declared above, so we init tags here!
        .enter()
        .append("g")
        .attr("class", "tag_top")
        .on('click', function (d, i) {
            var c;
            // undefined is treated as if it was 'false'
            strip_toggled[i] = !strip_toggled[i];
            // set/reset the color:
            c = (strip_toggled[i] ? '#ff6600' : color(i / n));

            // tweak the top_tag rect:
            //d3.select(this).select("rect") -- needs class or id to pick the right one; less coding work to copy&paste:
            top_marker_rects
                .each(function (d, idx) {
                    if (idx == i)
                        d3.select(this).style("fill", c);
                });

            // also tweak the stream strip:
            stream_strips
                .each(function (d, idx) {
                    if (idx == i)
                        d3.select(this).style("fill", c);
                });
        })
        // set opacity up right now so on transition it'll start at 1.0:
        .attr("opacity", 1)
        .on("mouseover", function (d, i) {
            // you'll get a slightly different animation when hovering here, rather than over the strips themselves.
            // Here we only 'fade' the strips, but highlight the tag, instead of fade out the others.
            stream_strips
                .transition()
                .duration(1000)
                .attr("opacity", function (d, j) {
                    return j != i ? 0.2 : 1;
                });
            d3.select(this)
                .classed("hover", true);
        })
        .on("mouseout", function (d, i) {
            stream_strips
                .transition()
                .duration(1000)
                .attr("opacity", 1);
            d3.select(this)
                .classed("hover", false);
        });

    var top_wrappers = topside_sel
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .classed("wrapper", true);

    var top_marker_rects = topside_sel
        .append("rect")
        .style("fill", function (d, i) {
            return color(i / n);
        })
        .attr("width", 10)
        .attr("height", 10)
        .attr("x", 1)
        .attr("y", 0);

    var top_marker_texts = topside_sel
        .append("text")
        .text(function (d, i) {
            return d.name;
        })
        .attr("x", 15)
        .attr("y", 10);

    /*
     WARNING: this is nasty hack to make sure the top texts get rendered, before we call
     .getBBox() in correct_tags_topside_positioning() for those nodes: as per
     spec getBBox only takes the actual CSS-styled font metrics into account
     once the node has been rendered.

     Not only do we have (minimal) risk of observing screen flicker now, but it
     also means that we can only search for suitably large areas in the stream strips
     and place the tags there ONLY ONCE this timer has fired, or that code would
     fail by using the wrong (guestimated) textbox width/height values!

     Anti-flicker through style="visibility: hidden;"

     WARNING: using a very short delay, e.g. 1 or 10, will FAIL TO DELIVER on Safari/Win at least:
     for some insane reason you must delay longer, I guess they want one VBL at least,
     but this sort of 'guess my timeout, buster!' behaviour gives me the Willies.

     Tested to FAIL on Safari 5/Win for delays up to 50 msec!

     As 100 msecs isn't always going to cut it, we do the HACK thing and place a text
     outside the view, then check its BBox results for a change to detect when bloody
     Safari has finally updated its internal SVG state.

     Turns out it's all due to the WebFonts in use here.

     https://developers.google.com/webfonts/faq#While_Loading
     http://paulirish.com/2009/fighting-the-font-face-fout/

     Keep in mind to DISABLE THE TIMER-BASED HACK when you change the styles to use local
     fonts!!
     */
    var bbox_hack = graph
        .append("text")
        .attr("class", "bbox_hack")
        .text("blurbyblurboblurbixbloodySafari!")
        .attr("x", 15)
        .attr("y", 100)
        .style("visibility", "hidden");
    bbox_hack.__bbox__ = bbox_hack.node().getBBox();
    var getBBox_will_be_correct = false;

    d3.timer(function (elapsed) {
        var hack = bbox_hack.node().getBBox();
        if (hack.width == bbox_hack.__bbox__.width && elapsed < 2000)
            return false;
        console.log("Safari fires BBox @ ", elapsed);
        getBBox_will_be_correct = true;

        header
            .style("visibility", "visible");
        correct_tags_topside_positioning(n);
        update_instream_tags();
        return true; // only invoke this one ONCE, i.e. be done with it.
    }, 100);

// --- end of hacked invocation of correct_tags_topside_positioning(n) ---


// the actual graphing work: draw the stream graph:
    var vis = graph.append("g");

    var stream_strips = vis.selectAll("path")
        .data(data0)
        .enter().append("path")
        .style("fill", function (d, i) {
            return color(i / n);
        })
        .attr("d", area)
        .on('click', function (d, i) {
            d3.select(this).style("fill", function () {
                var c;
                // undefined is treated as if it was 'false'
                strip_toggled[i] = !strip_toggled[i];
                // set/reset the color:
                c = (strip_toggled[i] ? '#ff6600' : color(i / n));

                // also tweak the top_tag rect:
                top_marker_rects
                    .each(function (d, idx) {
                        if (idx == i)
                            d3.select(this).style("fill", c);
                    });

                return c;
            });
        })
        // set opacity up right now so on transition it'll start at 1.0:
        .attr("opacity", 1)
        .on("mouseover", function (d, i) {
            stream_strips
                .transition()
                .duration(1000)
                .attr("opacity", function (d, j) {
                    return j != i ? 0.2 : 1;
                });
            topside_sel
                .transition()
                .duration(1000)
                .attr("opacity", function (d, j) {
                    return j != i ? 0.2 : 1;
                });
        })
        .on("mouseout", function (d, i) {
            stream_strips
                .transition()
                .duration(1000)
                .attr("opacity", 1);
            topside_sel
                .transition()
                .duration(1000)
                .attr("opacity", 1);
        });


// and set up the SVG nodes for the tags-in-stream:
    var tags_instream = graph.append("g")
        .attr("class", "tags_in_stream");

    var tags_instream_sel = tags_instream.selectAll("text")
        .data(tags)
        .enter()
        .append("text")
        .style("pointer-events", "none")
        .text(function (d, i) {
            return d.name;
        })
        .attr("x", w / 2)
        .attr("y", h / 2)
        //.style("visibility", "hidden")
        .attr("opacity", 0);
}


function transition() {
    d3.selectAll("path")
        .data(function() {
            var d = data1;
            data1 = data0;
            return data0 = d;
        })
        .transition()
        .duration(2500)
        .attr("d", area)
        // hide at start of animation, then show new ones at end of transition:
        .each("start", function() {
            tags_instream_sel
            //.style("visibility", "hidden")
                .transition()
                .attr("opacity", 0);
        })
        .each("end", function() {
            // and update the instream tags; only do so iff the getBBox fix already fired
            if (getBBox_will_be_correct) {
                update_instream_tags();
            }
        });
}



// generate semi-random tags to go with the points dataset
function names_gen(n) {
    var a = [];
    var o = {};
    var snip = ["aero", "blu", "foo", "bar", "nal", "skip", "sky", "jam", "poon", "tang", "ploo", "ker", "hum", "di", "com", "tan", "te", "pu", "ter"];
    var i, l, c, s;

    for (i = 0; i < n; i++) {
        s = "";
        for (l = Math.max(0, Math.log(Math.random() * 11)); l >= 0; l--) {
            c = Math.floor(Math.random() * snip.length);
            s += snip[c];
        }
        if (s.length < 3 || o[s]) {
            // too short for our taste or just a dupe
            i--;
            continue;
        }
        o[s] = 1;
        a.push({
            name: s,
            // just a random starting point for the in-stream tags:
            x: Math.random() * w,
            y: Math.random() * h
        });
    }
    // Now roughly estimate position for 'topside' plotting of the texts, based on the length of the strings.
    // This is blatantly negigent of proportional fonts! but we use it anyway as a starting heuristic to get 'good'
    // placing; as good placement is dependent on the actual BBoxes, we 'adjust' the positioning once we got
    // set plotted and have access to their BBoxes.
    l = 0;
    for (i = 0; i < n; i++) {
        l += a[i].name.length;
    }
    c = (w - n * 20) / l;
    l = 0;
    for (i = 0; i < n; i++) {
        a[i].top_x = Math.round(i * 20 + l * c);
        l += a[i].name.length;
    }
    return a;
}

function correct_tags_topside_positioning(n) {
    var i, l, v, c, top_sel;

    top_marker_texts
        .each(function(d, i) {
            // and get the actual pixel width of the text node, we'll need it for placing it in the streamgraph proper:
            var bbox = this.getBBox();
            d.text_bbox = bbox;
        });

    l = 0;
    v = 0;
    for (i = 0; i < n; i++) {
        l += tags[i].text_bbox.width;
        v = Math.max(v, tags[i].text_bbox.height);
    }
    c = (w - n * 20) / l;
    l = 0;
    for (i = 0; i < n; i++) {
        tags[i].top_x = Math.round(i * 20 + l * c);
        l += tags[i].text_bbox.width;
    }

    // adjust the tags printed at the top:
    //top_sel = header.selectAll("g.tag_top")... but reusing the vars is faster:
    topside_sel
    // .data(tags) -- no need, we're only updating and the changes are accessible already as the tags elems are refenced by the svg nodes!
        .attr("transform", function(d, i) {
            return "translate(" + d.top_x + ",20)";
        });

    top_wrappers
        .attr("width", function(d, i) {
            return 20 + d.text_bbox.width;
        })
        .attr("height", v);

    top_marker_rects
        .attr("y", /* center vertically */ (v - 10) / 2);

    top_marker_texts
        .attr("y", function(d, i) {
            return 10 - d.text_bbox.y;
        });
}

function update_instream_tags() {
    // now that we got all that, it's time to see if and where to put the tags inside the stream strips:
    tags_instream_sel
        .each(function(d, i) {
            d.tag_opt_place = find_instream_tag_print_position_optimum(i);
            if (!d.tag_opt_place) {
                d3.select(this)
                    //.style("visibility", "hidden")
                    .transition()
                    .attr("opacity", 0);
            } else {
                d3.select(this)
                    //.style("visibility", "visible")
                    .style("font-size", Math.floor(d.tag_opt_place.scale * 100) + "%")
                    // scaling fonts isn't what I'ld expect, so center the text horizontally:
                    .style("text-align", "center")
                    .attr("x", function() {
                        return x(d.tag_opt_place.x);
                    })
                    .attr("y", function() {
                        return h - y(d.tag_opt_place.y) +
                            // lift baseline accordingly:
                            Math.min(0, d.tag_opt_place.bbox.y * d.tag_opt_place.scale);
                    })
                    .transition()
                    .attr("opacity", 1);

                // visual debug aids:
                if (0) {
                    tags_instream
                        .append("rect")
                        .attr("fill", "none")
                        .attr("stroke", "green")
                        .attr("width", function() {
                            return x(Math.max(0.02, d.tag_opt_place.x1 - d.tag_opt_place.x0));
                        })
                        .attr("height", function() {
                            return y(d.tag_opt_place.y_max - d.tag_opt_place.y_min);
                        })
                        .attr("x", function() {
                            return x(d.tag_opt_place.x0);
                        })
                        .attr("y", function() {
                            return h - y(d.tag_opt_place.y_max);
                        });
                    tags_instream
                        .append("circle")
                        .attr("fill", "red")
                        .attr("r", 5)
                        .attr("cx", function() {
                            return x(d.tag_opt_place.x);
                        })
                        .attr("cy", function() {
                            return h - y(d.tag_opt_place.y);
                        });
                }
            }
        });
}


/*
 Naive approach to find the largest inscribed rectangle in a polygon.

 I didn't research the algorithms available, but tried here what I came up with myself,
 which can surely be improved upon.

 The approach is simply to scan from left to right through the (x,y0,y) set for a
 stream strip (~ polygon) and seek the longest horizontal 'scanline' which allows
 for a minimum rectangle height equal to the height of the tag text at the top:
 this is chosen as a 'sane minimum size' as we assume that any smaller text inside
 the stream will be ridiculous from a viewability POV.
 Bigger of course is better, but we can only do that when the horizontal scanline
 length is larger than the required mimum for displaying the text at minimum scale.

 To speed up the worst-case O(n^2) scan process we skip and 'stop' the scan at any
 x where the height (y) is less than the required minimum height.
 */
function find_instream_tag_print_position_optimum(i) {
    // we assume that we already have the BBox w+h for the tag:
    var poly = data0[i];
    var tinfo = tags[i];
    var reqd_y = tinfo.text_bbox.height / y(1); // convert to *data* units: inverse of screen px transforms
    var reqd_x = tinfo.text_bbox.width / x(1);
    var optimum;
    /*
     improvement #1: slower but more accurate for low point counts: interpolate between [x] points to produce more opportunities to
     find a suitable space using the 'lazy' scan, which assumes there's points enough to not bother with polygon & scanline algos.
     */
    var step_x = Math.min(1, 1 / x(1));
    /*
     improvement #2: for better visual palatability, stay away from the left and right edge by 'padding' pixels, so that the tag texts
     don't end up smack against the side, left or right.
     */
    var x_padding = (0.02 * w) / x(1); // padding: 2% of graph width
    var x_end = m - 1 - x_padding;

    function v(i) {
        var i0 = Math.floor(i);
        var i_delta = i - i0;
        var v0 = poly[i0];
        if (i0 + 1 < m && i_delta >= step_x)  {
            var v1 = poly[i0 + 1];
            return {
                x: i,
                y0: v0.y0 + (v1.y0 - v0.y0) * i_delta,
                y: v0.y + (v1.y - v0.y) * i_delta
            };
        }
        return v0;
    }

    for (var i = x_padding; i <= x_end; i += step_x) {
        var v1 = v(i);
        if (v1.y < reqd_y)
            continue;
        // speed up: scan forward to see if we have any chance at getting the minimum reqd width:
        if (i + reqd_x > x_end)
            continue;
        var y_min = v1.y0, y_max = y_min + v1.y;
        var scale = 0;
        for (var j = step_x; i + j <= x_end; j += step_x) {
            var v2 = v(i + j);
            if (v2.y < reqd_y)
                break;
            // cut off by rise from below?
            if (v2.y0 > y_max - reqd_y)
                break;
            // cut off by drop from above?
            if (v2.y0 + v2.y < y_min + reqd_y)
                break;
            var y_min1, y_max1;
            y_min1 = Math.max(v2.y0, y_min);
            y_max1 = Math.min(v2.y0 + v2.y, y_max);
            var scale_new = Math.min(j / reqd_x, (y_max1 - y_min1) / reqd_y);
            if (scale_new < scale)
                break;
            scale = scale_new;
            y_min = y_min1;
            y_max = y_max1;
        }
        // allow edge case where reqd_x = 1 would fit in a rhombus --> j = 1 here (and so on for higher reqd_x)
        if (j < reqd_x)
            continue;
        /*
         Here we get VERY lazy: instead of a proper double scanline algorithm, which can find
         inscribed rectangle at non-integer x positions, we try the lazy route by looking at
         whether we can drop a rectangle in the space delineated by the x points themselves
         */
        // simplified search: we have a minimum width at least, how high can we go?
        var scale = Math.min(j / reqd_x, (y_max - y_min) / reqd_y);
        if (scale >= 1) {
            if (!optimum || optimum.scale < scale) {
                var x_offset = scale * reqd_x;
                x_offset = (j - x_offset) / 2;
                var y_offset = scale * reqd_y;
                y_offset = (y_max + y_min - y_offset) / 2;
                optimum = {
                    scale: scale,
                    x: i /* + x_offset */,
                    y: y_offset,
                    reqd_x: reqd_x,
                    reqd_y: reqd_y,
                    y_min: y_min,
                    y_max: y_max,
                    x0: i,
                    x1: i + j - step_x,
                    bbox: tinfo.text_bbox
                };
                continue;
            }
        }
        /*
         TODO:

         Use a double scanline approach where we determine the interpolated X start
         position where we can deliver a left edge of the minimum required height,
         then scan forward to find the right-most interpolated X where the right edge
         of the inscribed rect will be.

         After that, or at the same time, the task is to also see if anything larger
         is possible, i.e. find the biggest inscribed rect, where the text scale
         determines the optimum (which is not strictly speaking identical to finding
         the biggest inscribed rect in terms of surface area!)
         */
    }

    return optimum; // WARNING: MAY be falsey!
}