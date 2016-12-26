'use strict';

function SliderController($slider, name, range) {
    range = range || 100;
    var $label = $slider.find('span');

    function set_position(value) {
        $label.css('left', value);
        $.publish('slider.'+name+'.update', {
            name: name, value: get()
        });
    }

    function get() {
        var label_width = $label.width();
        var slider_width = $slider.width();
        var value = range * ($label.position().left + label_width/2) / slider_width;
        return value | 0;
    }

    $label.mousedown(function (mousedown_evt) {
        var label_width = $label.width();
        var slider_width = $slider.width();
        var x0 = mousedown_evt.pageX;
        var pos0 = $label.position().left + label_width/2;
        $label.on('mousemove.slider.'+name, function (evt) {
            var new_pos = pos0 + (evt.pageX - x0);
            if (new_pos < 0) {
                new_pos = 0;
            } else if (new_pos > slider_width) {
                new_pos = slider_width;
            }
            var step_size = slider_width / range;
            if (step_size > 3) new_pos = step_size * Math.round(new_pos / step_size);
            set_position(new_pos - label_width/2);
        })
    });
    $label.mouseup(function () {
        $label.off('mousemove.slider.'+name);
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


$(document).ready(function () {
    var $slider = $('.range-slider [class=red]').parent();
    var slider = SliderController($slider, 'color-red', 35);
    slider.subscribe(function(info) {
        input.val(info.value);
    });
    window.slider = slider;
    var input = $slider.next();
    $('#cmd-save').click(function() {
        console.log("click");
        slider.set(input.val());
    });
});
