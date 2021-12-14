export class BreathPacer {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private points!: BreathPacerPoint[];
    private cfg: BreathPacerConfig;

    private running: boolean = false;
    private startTime: number | null = null;

    static readonly defaults: BreathPacerConfig = {
        delay: 1000/60,
        guideFillStyle: "Gold",
        guideRadius: 30,
        offsetProportionX: 2/5,
        offsetProportionY: 4/5,
        rulerHeight: -0.2,
        rulerLineCap: "butt",
        rulerLineWidth: 10,
        rulerStrokeStyle: "RoyalBlue",
        scaleH: 400,
        scaleT: 1/10,
        trackLineCap: "round",
        trackLineJoin: "round",
        trackLineWidth: 10,
        trackStrokeStyle: "SeaGreen",
    };

    constructor(
        canvas: HTMLCanvasElement,
        instructions: BreathPacerInstruction[],
        cfg: Partial<BreathPacerConfig> = {},
    ) {
        // initialize canvas and context
        if (!canvas.getContext) {
            throw Error("canvas not supported");
        }
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (ctx === null) {
            throw Error("no drawing context");
        }
        this.ctx = ctx;
        // initialize points from instructions
        this.setInstructions(instructions);
        // initialize config with defaults, then overwrite
        this.cfg = {
            ...BreathPacer.defaults,
            ...cfg,
        };
        this.requestUpdate();
    }

    setInstructions(instructions: BreathPacerInstruction[]) {
        const points = [{t: 0, h: 0}];
        instructions.forEach(({duration, breathe}) => {
            const index = points.length;
            const t = points[index - 1].t + duration;
            const h = (() => {
                switch (breathe) {
                    case "in":
                        return 1;
                    case "out":
                        return 0;
                    case "hold":
                        return points[index - 1].h;
                    default:
                        throw new Error(`invalid value "${breathe}" for breathe`);
                }
            })();
            points.push({t, h});
        });
        this.points = points;
        this.requestUpdate();
    }

    setConfig(cfg: Partial<BreathPacerConfig>) {
        this.cfg = {
            ...this.cfg,
            ...cfg,
        };
        this.requestUpdate();
    }

    private update(time: number) {
        // bindings for constants
        const canvas = this.canvas;
        const ctx = this.ctx;
        const points = this.points;
        const cfg = this.cfg;
        // set startTime if still unset while running
        if (this.running && this.startTime === null) {
            this.startTime = time;
        }
        // compute coordinates of guide
        const guide = (() => {
            const t = this.startTime === null ? 0 : time - this.startTime;
            const h = (() => {
                // find nearest points enclosing t horizontally
                const [left, right] = (() => {
                    for (let index = 0; index < points.length - 1; ++index) {
                        const [left, right] = [points[index], points[index + 1]];
                        if (left.t <= t && t <= right.t) {
                            return [left, right];
                        }
                    }
                    const last = points[points.length - 1];
                    return [last, {...last, t: Number.POSITIVE_INFINITY}];
                })();
                // compute line of enclosing points
                const m = (right.h - left.h) / (right.t - left.t);
                const b = -m*left.t + left.h;
                // get h(t) from line equation
                return m*t + b;
            })();
            return {t: t, h: h};
        })();
        // define view transformation on world {t, h} coords to canvas [x, y] coords
        const view = ({t, h}: BreathPacerPoint): [number, number] => {
            return [
                cfg.scaleT*(t - guide.t) + cfg.offsetProportionX*canvas.width,
                -cfg.scaleH*h + cfg.offsetProportionY*canvas.height,
            ];
        };
        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // draw ruler
        ctx.beginPath();
        ctx.lineCap = cfg.rulerLineCap;
        ctx.lineWidth = cfg.rulerLineWidth;
        ctx.strokeStyle = cfg.rulerStrokeStyle;
        ctx.moveTo(...view({t: 0, h: cfg.rulerHeight}));
        ctx.lineTo(...view({t: points[points.length - 1].t, h: cfg.rulerHeight}));
        ctx.stroke();
        // draw track
        ctx.beginPath();
        ctx.lineCap = cfg.trackLineCap;
        ctx.lineJoin = cfg.trackLineJoin;
        ctx.lineWidth = cfg.trackLineWidth;
        ctx.strokeStyle = cfg.trackStrokeStyle;
        ctx.moveTo(...view(points[0]));
        for (const point of points.slice(1)) {
            ctx.lineTo(...view(point));
        }
        ctx.stroke();
        // draw guide
        ctx.beginPath();
        ctx.fillStyle = cfg.guideFillStyle;
        ctx.arc(...view(guide), cfg.guideRadius, 0, 2*Math.PI);
        ctx.fill();
        // request next frame if running and still on track
        if (this.running && guide.t <= points[points.length - 1].t) {
            this.requestUpdate();
        } else {
            this.running = false;
        }
    }

    requestUpdate() {
        window.requestAnimationFrame(this.update.bind(this));
    }

    start() {
        // set state to start of animation
        this.running = true;
        this.startTime = null;
        // start updating
        this.requestUpdate();
    }
}


interface BreathPacerPoint {
    t: number;
    h: number;
}


export interface BreathPacerInstruction {
    duration: number;
    breathe: "in" | "out" | "hold";
}


export interface BreathPacerConfig {
    delay: number,
    guideFillStyle: string,
    guideRadius: number,
    offsetProportionX: number,
    offsetProportionY: number,
    rulerHeight: number,
    rulerLineCap: CanvasLineCap,
    rulerLineWidth: number,
    rulerStrokeStyle: string,
    scaleH: number,
    scaleT: number,
    trackLineCap: CanvasLineCap,
    trackLineJoin: CanvasLineJoin,
    trackLineWidth: number,
    trackStrokeStyle: string,
}
