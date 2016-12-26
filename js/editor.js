'use strict';

function SliderController($slider, name, range) {
    range = range || 100;
    var $label = $slider.find('span');
    var start_point = null;

    function set_position(value) {
        $label.css('left', value);
        $.publish('slider.'+name+'.update', {
            slider: name, value: get()
        });
    }

    function get() {
        var label_width = $label.width();
        var slider_width = $slider.width();
        var value = range * ($label.position().left + label_width/2) / slider_width;
        return Math.round(value);
    }

    var $body = $('body');
    $label.mousedown(function (mousedown_evt) {
        var label_width = $label.width();
        start_point = {
            x: mousedown_evt.pageX,
            pos: $label.position().left + label_width / 2
        };
    });
    $body.on('mousemove.slider.'+name, function (evt) {
        if (!start_point) return;
        var label_width = $label.width();
        var slider_width = $slider.width();
        var new_pos = start_point.pos + (evt.pageX - start_point.x);
        if (new_pos < 0) {
            new_pos = 0;
        } else if (new_pos > slider_width) {
            new_pos = slider_width;
        }
        var step_size = slider_width / range;
        if (step_size > 3) new_pos = step_size * Math.round(new_pos / step_size);
        set_position(new_pos - label_width/2);
    });
    $body.mouseup(function () {
        start_point = null;
    });

    return {
        get: get,
        set: function(value) {
            if (value < 0) {
                value = 0;
            } else if (value > range) {
                value = range;
            }
            value = value | 0;
            var label_width = $label.width();
            var slider_width = $slider.width();
            var position = value * slider_width / range;
            set_position(position - label_width/2);
        },
        subscribe: function(handler) {
            $.subscribe('slider.'+name+'.update', function(evt, data) {
                handler(data);
            });
        }
    }
}


function ToolPicker($box, name) {
    var $buttons = $box.find('button');

    function pick($btn) {
        $buttons.removeClass('picked');
        $btn.addClass('picked');
        var tool_id = $btn.attr('id');
        $.publish('tool-pick.'+name, tool_id);
    }

    $buttons.click(function() {
        pick($(this));
    });

    return {
        pick: function(tool_id) {
            pick($box.find('button#' + tool_id));
        },
        subscribe: function(handler) {
            $.subscribe('tool-pick.'+name, function(evt, data) {
                handler(data);
            });
        }
    }
}


function CanvasController($canvas, name, initial_tool) {
    var tool = initial_tool;
    var canvas = $canvas[0];
    var context = canvas.getContext('2d');
    var history = [canvas.toDataURL()];
    var history_pos = 0;
    var max_history_len = 20;
    var options = {color: '#000000', width: 1};

    var running_tool = null, tool_state = null;

    $canvas.mousedown(function(evt) {
        running_tool = tool;
        var point = get_point(evt);
        context = canvas.getContext('2d');
        if (running_tool.begin)
            tool_state = running_tool.begin(context, point, options);
    });

    var $body = $('body');
    $body.mousemove(function(evt) {
        if (!running_tool) return;
        var point = get_point(evt);
        if (running_tool.move)
            running_tool.move(context, point, tool_state);
    });

    $body.mouseup(function (evt) {
        if (!running_tool) return;
        var point = get_point(evt);
        if (running_tool.end)
            running_tool.end(context, point, tool_state);
        if (history_pos < history.length-1) {
            history = history.slice(0, history_pos+1);
        }
        running_tool = null;
        var data_url = canvas.toDataURL();
        history.push(data_url);
        history_pos++;
        if (history.length > max_history_len) {
            history = history.splice(1);
            history_pos--;
        }
        publish();
    });

    function get_point(evt) {
        return {
            x: evt.pageX - $canvas.position().left,
            y: evt.pageY - $canvas.position().top
        }
    }

    function publish() {
        $.publish('canvas.'+name, {
            url: history[history_pos],
            history_pos: history_pos,
            history_len: history.length
        });
    }

    function draw_from_url(url) {
        redraw_canvas_from_url(context, url || history[history_pos]);
    }

    return {
        set_tool: function(new_tool) {
            tool = new_tool;
        },
        set_color: function(color) {
            options.color = color;
        },
        set_stroke_width: function (value) {
            options.width = value;
        },
        undo: function () {
            if (history_pos < 1) throw "Can not undo";
            history_pos--;
            draw_from_url();
            publish();
        },
        redo: function () {
            if (history_pos >= history.length-1) throw "Can not redo";
            history_pos++;
            draw_from_url();
            publish();
        },
        subscribe: function(handler) {
            handler(history[history_pos], history_pos, history.length);
            $.subscribe('canvas.'+name, function(evt, data) {
                handler(data.url, data.history_pos, data.history_len);
            });
        }
    }
}


function ColorSelector($element, name) {
    var color_components = {red: 0, green: 0, blue: 0};

    var $preview = $element.find('#color-preview');

    ['red', 'green', 'blue'].forEach(function (component) {
        var $slider = $element.find('.range-slider [class=' + component + ']').parent();
        var $input = $slider.next();

        var slider_ctl = SliderController($slider, 'color-selector.' + name + '.' + component, 255);
        $input.change(function () {
            slider_ctl.set($input.val());
        });
        slider_ctl.subscribe(function(info) {
            $input.val(info.value);
            color_components[component] = info.value;
            publish();
        });
        slider_ctl.set(0);
    });
    publish();

    function publish() {
        var clr = _build_color();
        $preview.css('background-color', clr);
        $.publish('color-selector.' + name, clr);
    }

    function _build_color() {
        return '#' + _to_hex(color_components.red)
            + _to_hex(color_components.green)
            + _to_hex(color_components.blue);
    }

    function _to_hex(value) {
        var hex = (value | 0).toString(16);
        return hex.length == 1 ? '0' + hex : hex;
    }

    return {
        subscribe: function(handler) {
            $.subscribe('color-selector.' + name, function (evt, clr) {
                handler(clr);
            });
        },
        publish: publish
    }
}


function redraw_canvas_from_url(ctx, url) {
    var img = document.createElement('img');
    img.src = url;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(img, 0, 0);
}


var Tools = {
    'tool-line': {
        begin: function(ctx, pt, opts) {
            ctx.lineWidth = opts.width;
            ctx.strokeStyle = opts.color;
            return {
                start_x: pt.x,
                start_y: pt.y,
                orig_image: ctx.canvas.toDataURL()
            }
        },
        move: function (ctx, pt, state) {
            redraw_canvas_from_url(ctx, state.orig_image);
            ctx.beginPath();
            ctx.moveTo(state.start_x, state.start_y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
        }
    },
    'tool-rect': {
        begin: function(ctx, pt, opts) {
            ctx.fillStyle = opts.color;
            return {
                start_x: pt.x,
                start_y: pt.y,
                orig_image: ctx.canvas.toDataURL()
            }
        },
        move: function (ctx, pt, state) {
            redraw_canvas_from_url(ctx, state.orig_image);
            var x = Math.min(state.start_x, pt.x),
                y = Math.min(state.start_y, pt.y),
                w = Math.abs(state.start_x - pt.x),
                h = Math.abs(state.start_y - pt.y);
            ctx.fillRect(x, y, w, h);
        }
    },
    'tool-circle': {
        begin: function(ctx, pt, opts) {
            ctx.fillStyle = opts.color;
            return {
                start_x: pt.x,
                start_y: pt.y,
                orig_image: ctx.canvas.toDataURL()
            }
        },
        move: function (ctx, pt, state) {
            redraw_canvas_from_url(ctx, state.orig_image);
            var x = Math.min(state.start_x, pt.x),
                y = Math.min(state.start_y, pt.y),
                w = Math.abs(state.start_x - pt.x),
                h = Math.abs(state.start_y - pt.y);
            ctx.beginPath();
            ctx.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, 2*Math.PI);
            ctx.fill();
        }
    },
    'tool-brush': {
        begin: function(ctx, pt, opts) {
            ctx.fillStyle = opts.color;
            ctx.strokeStyle = opts.color;
            ctx.lineWidth = 2*opts.width;
            return {radius: opts.width, has_previous: false};
        },
        move: function(ctx, pt, state) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, state.radius, 0, 2*Math.PI);
            ctx.fill();
            if (state.has_previous) {
                ctx.beginPath();
                ctx.moveTo(state.prev_x, state.prev_y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
            }
            state.has_previous = true;
            state.prev_x = pt.x;
            state.prev_y = pt.y;
        }
    },
    'tool-spray': {
        begin: function (ctx, pt, opts) {
            ctx.fillStyle = opts.color;
            var state = {
                x: pt.x, y: pt.y
            };
            function random_spray() {
                var angle = Math.random() * 2 * Math.PI;
                var distance = Math.random() * opts.width * 10;
                var x = state.x + distance * Math.cos(angle);
                var y = state.y + distance * Math.sin(angle);
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, 2*Math.PI);
                ctx.fill();
            }
            state.interval_id = setInterval(random_spray, 10);
            return state;
        },
        move: function (ctx, pt, state) {
            state.x = pt.x;
            state.y = pt.y;
        },
        end: function(ctx, pt, state) {
            clearInterval(state.interval_id);
        }
    },
    'tool-eraser': {
        begin: function (ctx, pt, opts) {
            ctx.fillStyle = '#FFFFFF';
            return opts.width;
        },
        move: function (ctx, pt, size) {
            ctx.fillRect(pt.x-size, pt.y-size, 2*size, 2*size);
        }
    }
};


$(document).ready(function () {

    var canv_ctl = CanvasController($('#draw-area'), 'canvas', Tools['tool-line']);
    var tool_picker = ToolPicker($('#tools'), 'tool-picker');
    var color_selector = ColorSelector($('#color-picker').parent(), 'color-picker');
    var width_slider = SliderController($('#width-selector .range-slider'), 'stroke-width', 5);

    width_slider.set(0);
    tool_picker.pick('tool-line');

    color_selector.subscribe(canv_ctl.set_color);
    width_slider.subscribe(function (info) {
        canv_ctl.set_stroke_width(info.value+1);
    });
    tool_picker.subscribe(function (tool_id) {
        canv_ctl.set_tool(Tools[tool_id]);
    });

    canv_ctl.subscribe(function(data_url, history_pos, history_len) {
        $('#cmd-undo').prop('disabled', history_pos == 0);
        $('#cmd-redo').prop('disabled', history_pos == history_len-1);
    });
    $('#cmd-undo').click(canv_ctl.undo);
    $('#cmd-redo').click(canv_ctl.redo);
});
