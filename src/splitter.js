(function($) {

    $.fn.splitter = function(args) {
        args = args || {};

        return this.each(function() {
            var zombie, // left-behind splitbar for outline resizes
                defaults = {
                    activeClass: 'active', // class name for active splitter
                    pxPerKey: 8,           // splitter px moved per keypress
                    tabIndex: 0,           // tab order indicator
                    accessKey: ''          // accessKey for splitbar
                },
                dependentDefaults = {
                    v : {
                        keyLeft: 39, keyRight: 37, cursor: "e-resize",
                        splitbarClass: "vsplitbar", outlineClass: "voutline",
                        type: 'v', eventPos: "pageX", origin: "left",
                        split: "width",  pxSplit: "offsetWidth",  side1: "Left", side2: "Right",
                        fixed: "height", pxFixed: "offsetHeight", side3: "Top",  side4: "Bottom"
                    },
                    h : {
                        keyTop: 40, keyBottom: 38,  cursor: "n-resize",
                        splitbarClass: "hsplitbar", outlineClass: "houtline",
                        type: 'h', eventPos: "pageY", origin: "top",
                        split: "height", pxSplit: "offsetHeight", side1: "Top",  side2: "Bottom",
                        fixed: "width",  pxFixed: "offsetWidth",  side3: "Left", side4: "Right"
                    }
                },
                // Determine settings based on incoming options, element classes, and defaults
                splitType = (args.splitHorizontal ? 'h' : args.splitVertical ? 'v' : args.type) || 'v',
                options = $.extend(defaults, dependentDefaults[splitType], args),
                // Create jQuery object closures for splitter and both panes
                container = $(this),
                // Determine the panes
                panes = $(">*", container[0]),
                // left  or top
                firstPane = $(panes[0]),
                // right or bottom
                secondPane = $(panes[1]),
                // Focuser element, provides keyboard support; title is shown by Opera accessKeys
                focuser = $('<a href="javascript:void(0)"></a>'),
                // Splitbar element, can be already in the doc or we create one
                splitbar = $(panes[2] || '<div></div>'),
                initPos, cookieInitPos, state;

            container.css({position: "relative"});
            panes.css({
                position: "absolute",           // positioned inside splitter container
                "z-index": "1",                 // splitbar is positioned above
                "-moz-outline-style": "none"    // don't show dotted outline
            });
            
            firstPane.paneName = options.side1;
            secondPane.paneName = options.side2;

            focuser.attr({
                    accessKey: options.accessKey,
                    tabIndex: options.tabIndex,
                    title: options.splitbarClass
                })
                .bind($.browser.opera ? "click" : "focus", function() {
                    this.focus();
                    splitbar.addClass(options.activeClass);
                })
                .bind("keydown", function(e) {
                    var key = e.which || e.keyCode;
                    var dir = key === options["key" + options.side1] ? 1 : key === options["key" + options.side2] ? -1 : 0;
                    if (dir) {
                        resplit(firstPane[0][options.pxSplit] + dir * options.pxPerKey, false);
                    }
                })
                .bind("blur", function() {
                    splitbar.removeClass(options.activeClass);
                });

            splitbar.insertAfter(firstPane)
                .css("z-index", "100")
                .append(focuser)
                .attr({
                    "class": options.splitbarClass,
                    "unselectable": "on"
                })
                .css({
                    "position": "absolute",
                    "user-select": "none",
                    "-webkit-user-select": "none",
                    "-khtml-user-select": "none",
                    "-moz-user-select": "none"
                })
                .bind("mousedown", startSplitMouse);
                
            // Use our cursor unless the style specifies a non-default cursor
            if (/^(auto|default|)$/.test(splitbar.css("cursor"))) {
                splitbar.css("cursor", options.cursor);
            }

            // Cache several dimensions for speed, rather than re-querying constantly
            splitbar.primaryDimension = splitbar[0][options.pxSplit];
            
            container.primaryOffset = 0; 
            
            if ($.support.boxModel) { 
                container.primaryOffset = dimSum(container,
                        "border" + options.side1 + "Width",
                        "border" + options.side2 + "Width") +
                    dimSum(container.parent(),
                        "padding" + options.side1.toLowerCase(),
                        "padding" + options.side2.toLowerCase());
                container.secondaryOffset = dimSum(container,
                    "border" + options.side3 + "Width",
                    "border" + options.side4 + "Width") + 
                    dimSum(container.parent(),
                        "padding" + options.side3.toLowerCase(),
                        "padding" + options.side4.toLowerCase());
            }
                        
            $.each([firstPane,secondPane], function() {
                this.minSize = options["min" + this.paneName] || dimSum(this, "min-" + options.split);
                this.maxSize = options["max" + this.paneName] || dimSum(this, "max-" + options.split) || 9999;
                this.initSize = options["size" + this.paneName] === true ? 
                    parseInt($.curCSS(this[0], options.split), 10) : 
                    options["size" + this.paneName];
            });

            // Determine initial position, get from cookie if specified
            initPos = firstPane.initSize;
            if (!isNaN(secondPane.initSize)) {   // recalc initial secondPane size as an offset from the top or left side
                initPos = container[0][options.pxSplit] - container.primaryOffset - secondPane.initSize - splitbar.primaryDimension;
            }
            if (options.cookie) {
                if (!$.cookie) {
                    alert('jQuery.splitter(): jQuery cookie plugin required');
                }
                cookieInitPos = parseInt($.cookie(options.cookie), 10);
                if (!isNaN(cookieInitPos)) {
                    initPos = cookieInitPos;
                }
                $(window).bind("unload", function() {
                    state = String(splitbar.css(options.origin));    // current location of splitbar
                    $.cookie(options.cookie, state, {
                        expires: options.cookieExpires || 365,
                        path: options.cookiePath || document.location.pathname
                    });
                });
            }
            if (isNaN(initPos)) {    // King Solomon's algorithm
                initPos = Math.round((container[0][options.pxSplit] - container.primaryOffset - splitbar.primaryDimension) / 2);
            }

            // Resize event propagation and splitter sizing
            if (options.anchorToWindow) {
                // Account for margin or border on the splitter container and enforce min height
                container.heightAdjust = dimSum(container, "borderTopWidth", "borderBottomWidth", "marginTop", "marginBottom") + 
                    dimSum(container.parent(), "padding-top", "padding-bottom");
                container.minHeight = Math.max(dimSum(container, "minHeight"), 20);
                $(window).bind("resize", function() {
                    var top = container.offset().top,
                        windowHeight = $(window).height();
                        
                    container.css("height", Math.max(windowHeight - top - container.heightAdjust, container.minHeight) + "px");
                    if (!$.browser.msie) {
                        container.trigger("resize");
                    }
                }).trigger("resize");
            } else if (options.resizeToWidth && !$.browser.msie) {
                $(window).bind("resize", function() {
                    container.trigger("resize");
                });
            }

            // Resize event handler; triggered immediately to set initial position
            container.bind("resize", function(e, size) {
                // Custom events bubble in jQuery 1.3; don't get into a Yo Dawg
                if (e.target !== this) {
                    return;
                }
                // Determine new width/height of splitter container
                container.primaryDimension = container[0][options.pxSplit] - container.primaryOffset;
                container.secondaryDimension = container[0][options.pxFixed] - container.secondaryOffset;
                // Bail if splitter isn't visible or content isn't there yet
                if (container.secondaryDimension <= 0 || container.primaryDimension <= 0) {
                    return;
                }
                // Re-divvy the adjustable dimension; maintain size of the preferred pane
                resplit(!isNaN(size) ? size : (!(options.sizeRight || options.sizeBottom) ? firstPane[0][options.pxSplit] :
                    container.primaryDimension - secondPane[0][options.pxSplit] - splitbar.primaryDimension));
            }).trigger("resize", [initPos]);

            function startSplitMouse(evt) {
                if (options.outline) {
                    zombie = zombie || splitbar.clone(false).insertAfter(firstPane);
                }
                panes.css("-webkit-user-select", "none"); // Safari selects firstPane/secondPane text on a move
                splitbar.addClass(options.activeClass);
                firstPane._posSplit = firstPane[0][options.pxSplit] - evt[options.eventPos];
                $(document)
                    .bind("mousemove", doSplitMouse)
                    .bind("mouseup", endSplitMouse);
            }

            function doSplitMouse(evt) {
                var newPos = firstPane._posSplit + evt[options.eventPos];
                if (options.outline) {
                    newPos = Math.max(0, Math.min(newPos, container.primaryDimension - splitbar.primaryDimension));
                    splitbar.css(options.origin, newPos);
                } else {
                    resplit(newPos);
                }
            }

            function endSplitMouse(evt) {
                var newPos;
                
                splitbar.removeClass(options.activeClass);
                newPos = firstPane._posSplit + evt[options.eventPos];
                if (options.outline) {
                    zombie.remove();
                    zombie = null;
                    resplit(newPos);
                }
                panes.css("-webkit-user-select", "text"); // let Safari select text again
                $(document)
                    .unbind("mousemove", doSplitMouse)
                    .unbind("mouseup", endSplitMouse);
            }

            function resplit(newPos) {
                // Constrain new splitbar position to fit pane size limits
                newPos = Math.max(firstPane.minSize, container.primaryDimension - secondPane.maxSize,
                    Math.min(newPos, firstPane.maxSize, container.primaryDimension - splitbar.primaryDimension - secondPane.minSize));
                // Resize/position the two panes
                splitbar.primaryDimension = splitbar[0][options.pxSplit];		// bar size may change during dock
                splitbar.css(options.origin, newPos).css(options.fixed, container.secondaryDimension);
                firstPane.css(options.origin, 0).css(options.split, newPos).css(options.fixed, container.secondaryDimension);
                secondPane.css(options.origin, newPos + splitbar.primaryDimension)
                    .css(options.split, container.primaryDimension - splitbar.primaryDimension - newPos)
                    .css(options.fixed, container.secondaryDimension);
                // IE fires resize for us; all others pay cash
                if (!$.browser.msie) {
                    panes.trigger("resize");
                }
            }

            function dimSum(jq, dims) {
                // Opera returns -1 for missing min/max width, turn into 0
                var sum = 0, i;

                for (i = 1; i < arguments.length; i++) {
                    sum += Math.max(parseInt(jq.css(arguments[i]), 10) || 0, 0);
                }

                return sum;
            }
        });
    };

})(jQuery);