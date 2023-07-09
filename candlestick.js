var requestAnimationFrame = (
    window.requestAnimationFrame || 
    window.mozRequestAnimationFrame || 
    window.webkitRequestAnimationFrame || 
    window.msRequestAnimationFrame);

class CandleStick {
    constructor(container_element) {
        this.container_element = container_element;
        this.container_element.style.position = "relative";

        this.canvas = document.createElement("canvas");
        this.canvas.style.cssText = "width: 100%; height: 100%; cursor: crosshair;";
        this.container_element.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");

        this.crosshair_canvas = document.createElement("canvas");
        this.crosshair_canvas.style.cssText = "width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;";
        this.container_element.appendChild(this.crosshair_canvas);
        this.crosshair_ctx = this.crosshair_canvas.getContext("2d");

        window.addEventListener("load", () => { 
            this.set_canvas_size();
        });
        window.addEventListener("resize", () => {
            this.set_canvas_size();
            this.draw();
        });

        this.init_candle_width = 13;  // always odd number
        this.init_candle_margin = 3;
        this.init_wick_width = 1;  // always odd number

        this.scale_multiplier = 1;
        this.candle_width = this.init_candle_width; // always odd number
        this.candle_margin = this.init_candle_margin;
        this.wick_width = this.init_wick_width; // always odd number

        this.x_scroll_speed = 2;
        this.zoom_sensitivity = 0.001;

        this.data_url = "data/data.json";
        this.data = [];
        this.get_data();

        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();

            let updated_canvas_begin_x = this.canvas_begin_x + e.deltaX * this.x_scroll_speed;
            
            let updated_scale_multiplier = Math.max(this.scale_multiplier - e.deltaY * this.zoom_sensitivity, 0);
            let updated_candle_width = Math.round(this.init_candle_width * updated_scale_multiplier);
            updated_candle_width = updated_candle_width % 2 === 0 ? updated_candle_width + 1 : updated_candle_width;
            let updated_candle_margin = Math.round(this.init_candle_margin * updated_scale_multiplier);
            let updated_wick_width = Math.round(this.init_wick_width * updated_scale_multiplier);
            updated_wick_width = updated_wick_width % 2 === 0 ? updated_wick_width + 1 : updated_wick_width;
            updated_canvas_begin_x = updated_canvas_begin_x + this.data_end_index * (updated_candle_width + 2*updated_candle_margin - this.candle_width - 2*this.candle_margin);
            
            updated_canvas_begin_x = Math.max(updated_canvas_begin_x, -this.canvas.width);
            updated_canvas_begin_x = Math.min(updated_canvas_begin_x, (this.candle_width + 2*this.candle_margin) * this.data.length);

            this.canvas_begin_x = Math.round(updated_canvas_begin_x);
            this.scale_multiplier = updated_scale_multiplier;
            this.candle_width = updated_candle_width;
            this.candle_margin = updated_candle_margin;
            this.wick_width = updated_wick_width;
            this.draw();
        });

        this.canvas.addEventListener("mousemove", (e) => {
            this.draw_crosshair(e.offsetX*this.dpr, e.offsetY*this.dpr);
        });
        this.canvas.addEventListener("mouseleave", (e) => {
            this.crosshair_ctx.clearRect(0, 0, this.crosshair_canvas.width, this.crosshair_canvas.height);
        });
    }
    get_data() {
        fetch(this.data_url)
        .then(response => response.json())
        .then(data => { 
            this.data = data;
            this.set_canvas_size();
            this.canvas_begin_x = (this.candle_width + 2*this.candle_margin) * this.data.length - Math.floor(this.canvas.width*0.75);
            this.canvas_begin_x = Math.max(this.canvas_begin_x, -this.canvas.width);
            this.draw();
        });
    }
    set_canvas_size() {
        const rect = this.container_element.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.crosshair_canvas.width = rect.width * this.dpr;
        this.crosshair_canvas.height = rect.height * this.dpr;
    }
    draw() {
        this.data_start_index = Math.floor(this.canvas_begin_x / (this.candle_width + 2*this.candle_margin));
        this.data_start_index = Math.max(this.data_start_index, 0);
        this.data_start_index = Math.min(this.data_start_index, this.data.length - 1);
        this.data_end_index = Math.floor((this.canvas_begin_x + this.canvas.width) / (this.candle_width + 2*this.candle_margin));
        this.data_end_index = Math.min(this.data_end_index, this.data.length - 1);
        this.data_end_index = Math.max(this.data_end_index, 0);
        this.data_in_view = this.data.slice(this.data_start_index, this.data_end_index);

        this.max_high_in_view = Math.max(...this.data_in_view.map(d => d[2]));
        this.min_low_in_view = Math.min(...this.data_in_view.map(d => d[3]));
        this.y_scale_factor = this.canvas.height / (this.max_high_in_view - this.min_low_in_view);

        this.upcandle_path = new Path2D();
        this.downcandle_path = new Path2D();
        this.wick_path = new Path2D();

        this.data_in_view.forEach((d, i) => {
            const index = this.data_start_index + i;
            const [o, h, l, c] = d.slice(1, 5);

            const wick_height = Math.round((h - l)*this.y_scale_factor);
            const wick_y_begin = Math.round((this.max_high_in_view - h)*this.y_scale_factor);
            const wick_x_begin = Math.round((this.candle_width + 2*this.candle_margin) * index + this.candle_margin + this.candle_width/2 - this.wick_width/2) - this.canvas_begin_x;
            this.wick_path.rect(wick_x_begin, wick_y_begin, this.wick_width, wick_height);

            const candle_height = Math.round(Math.abs(o - c)*this.y_scale_factor);
            const candle_y_begin = Math.round((this.max_high_in_view - Math.max(o, c))*this.y_scale_factor);
            const candle_x_begin = Math.round((this.candle_width + 2*this.candle_margin) * index + this.candle_margin) - this.canvas_begin_x;
            if (o < c) {
                this.upcandle_path.rect(candle_x_begin, candle_y_begin, this.candle_width, candle_height);
            } else {
                this.downcandle_path.rect(candle_x_begin, candle_y_begin, this.candle_width, candle_height);
            }
        });

        requestAnimationFrame(() => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "#4a4948";
            this.ctx.fill(this.wick_path);
            this.ctx.fillStyle = "#B8D8BE";
            this.ctx.fill(this.upcandle_path);
            this.ctx.fillStyle = "#EE6969";
            this.ctx.fill(this.downcandle_path);
        });

    }
    draw_crosshair(x, y) {
        const cross_hair_data_index = Math.floor((x + this.canvas_begin_x) / (this.candle_width + 2*this.candle_margin));
        const cross_hair_x = (this.candle_width + 2*this.candle_margin) * cross_hair_data_index + this.candle_margin + this.candle_width/2 - this.canvas_begin_x;
        // round to nearest 0.5
        const cross_hair_y = Math.round(y/0.5)*0.5;

        requestAnimationFrame(() => {
            this.crosshair_ctx.clearRect(0, 0, this.crosshair_canvas.width, this.crosshair_canvas.height);
            this.crosshair_ctx.setLineDash([5, 5]);
            this.crosshair_ctx.beginPath();
            this.crosshair_ctx.moveTo(cross_hair_x, 0);
            this.crosshair_ctx.lineTo(cross_hair_x, this.crosshair_canvas.height);
            this.crosshair_ctx.moveTo(0, y);
            this.crosshair_ctx.lineTo(this.crosshair_canvas.width, y);
            this.crosshair_ctx.strokeStyle = "#4a4948";
            this.crosshair_ctx.stroke();
        });
    }
}