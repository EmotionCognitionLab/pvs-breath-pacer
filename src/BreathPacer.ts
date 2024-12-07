export class BreathPacer {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private points!: BreathPacerPoint[];
    private cfg: BreathPacerConfig;

    private audioInhale?: HTMLAudioElement;
    private audioExhale?: HTMLAudioElement;
    private running: boolean = false;
    private t: number = 0;
    private lastInstant: number | null = null;
    private lastH: number = 0;
    private lastT: number = 0;
    private lastSlope: number = 0;
    private resolve: (() => void) | null = null;
    private regimeBoundaries: {boundary:number, regime:BreathPacerRegime}[] = [];
    private subscribers: { (changeTime: number, regime: BreathPacerRegime): void; }[] = [];

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
        instructions: BreathPacerRegime[],
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
        if (this.cfg.audioInhaleUrl) {
            this.audioInhale = new Audio(this.cfg.audioInhaleUrl)
        }
        if (this.cfg.audioExhaleUrl) {
            this.audioExhale = new Audio(this.cfg.audioExhaleUrl)
        }
        this.requestUpdate();
    }

    notify(curTime: number) {
        if (!this.running) return;

        if (this.regimeBoundaries.length > 0 && curTime >= this.regimeBoundaries[0].boundary) {
            const nextRegime = this.regimeBoundaries.shift();
            if (nextRegime) {
                this.subscribers.forEach(subCallback => subCallback(curTime, nextRegime.regime));
            } else {
                throw new Error('Unexpected state: Starting undefined breath pacing regime');
            }
        }
    }

    /**
     * Use this function to be notified when the pacer switches from one regime to another.
     * The callback you provide will be called with two params:
     * (1) The number of ms since the pacer started.
     * (2) The BreathPacerRegime that is currently starting.
     * This means that the first call will happen almost synchronously with bp.start() being called
     * and that the number of ms for the first regime will be 0.
     * Note that the second (and subsequent) calls will not necessarily happen at exactly the
     * number of ms one would expect based on the durations of the preceding regimes, as regimes
     * may either be random or need adjustment to allow for a complete number of breaths, either
     * of which can cause them to be longer than specified.
     * @param callbackFn A function that accepts change time (number of ms) and BreathPacerRegime paramaeters.
     */
    subscribeToRegimeChanges(callbackFn: (changeTime: number, r: BreathPacerRegime) => void) {
        this.subscribers.push(callbackFn);
    }

    setInstructions(regimes: BreathPacerRegime[]) {
        const result = BreathPacerUtilities.regimesToInstructions(regimes);
        this.regimeBoundaries = result.boundaries;
        this.points = result.points;
        this.requestUpdate();
    }

    setConfig(cfg: Partial<BreathPacerConfig>) {
        this.cfg = {
            ...this.cfg,
            ...cfg,
        };
        this.requestUpdate();
    }

    private update(instant: number) {
        // update state if running
        if (this.running) {
            // t doesn't change on the first update
            if (this.lastInstant !== null) {
                this.lastT = this.t;
                this.t += instant - this.lastInstant;
            }
            this.lastInstant = instant;
        }
        this.notify(this.t);
        // bindings for convenience
        const canvas = this.canvas;
        const cfg = this.cfg;
        const ctx = this.ctx;
        const points = this.points;
        // compute coordinates of guide
        const guide = {
            t: this.t,
            h: BreathPacerUtilities.guideHeight(points, this.t),
        };
        // compute slope and see if direction has changed
        const rise = guide.h - this.lastH;
        const run = this.t - this.lastT;
        if (run > 0) {
            const slope = rise / run;
            if (this.lastSlope <= 0 && slope > 0) {
                this.audioInhale?.play();
            } else if (this.lastSlope >= 0 && slope < 0) {
                this.audioExhale?.play();
            }
            this.lastSlope = slope;
            this.lastH = guide.h;
        }
        
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
        // if currently running, choose to either continue or stop the animation
        if (this.running) {
            if (guide.t <= points[points.length - 1].t) {
                // continue animating if still on track
                this.requestUpdate();
            } else {
                // stop animating and resolve promise if beyond track
                this.pause();
                this.resolve?.();
            }
        }
    }

    private requestUpdate() {
        window.requestAnimationFrame(this.update.bind(this));
    }

    isRunning(): boolean {
        return this.running;
    }

    resume() {
        this.running = true;
        this.lastInstant = null;
        this.requestUpdate()
    }

    pause() {
        this.running = false;
        this.lastInstant = null;
    }

    start(): Promise<void> {
        // set state to start of animation
        this.t = 0;
        // resume animation
        this.resume();
        // return promise
        return new Promise((resolve, _) => {
            this.resolve = resolve;
        });
    }
}

export class BreathPacerUtilities {
    static guideHeight(points: BreathPacerPoint[], t: number): number {
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
    }
    
    static validateRegime(regime: BreathPacerRegime): void {
        if (regime.breathsPerMinute < 1) {
            throw new Error('The minimum breaths per minute is 1.');
        }
        if (regime.breathsPerMinute > 60) {
            throw new Error('The maximum breaths per minute is 60.');
        }
        if (regime.durationMs < 10000) {
            throw new Error('The minimum duration is 10000 (10 seconds).');
        }
        const msPerBreath = ( 60 / regime.breathsPerMinute) * 1000;
        if (regime.durationMs < msPerBreath) {
            throw new Error('The minmimum number of breaths during the total duration is 1.')
        }
    }
    
    static makeRange(start:number, end:number, stepSize:number): number[] {
        const res:number[] = [];
        for (let i:number = start; i <= end; i += stepSize) {
            res.push(i);
        }
        return res;
    }

    /**
     * Builds out the list of points (time and height) for each inhalation, exhalation, and (optionally)
     * hold described by each regime in the regimes parameter. 
     * 
     * If the regime is not randomized, each inhalation, exhalation, and (optionally) hold will be 
     * same length for a given regime. That length will be either 1/2 (if there is no hold) or 1/3
     * (if there is a hold) of the time that a total breath should last, based on the number of breaths
     * per minute and the total duration of the regime. 
     * 
     * If the regime is randomized, each inhalation, exhalation, and (optionally) hold will be a random
     * duration within a given range. The range is +/- 1 second (if no hold) or +/- 0.66 seconds (if 
     * there is a hold) around the length that the inhalation/exhalation/hold would be in the non-random case.
     * 
     * It is possible to describe a regime that results in a non-integral number of breaths. In this case
     * the number of breaths will be increased to the next whole number, resulting in a slightly longer
     * regime than requested. (And, of course, a slightly different number of breaths per minute than
     * requested.)
     * 
     * Randmoization can also result in a regime that is slightly longer or slightly shorter than requested,
     * as well as a number of breaths per minute that is higher or lower than requested, though if the regime duration
     * is long enough the average number of breaths per minute over the course of the whole duration should
     * work out to be close the requested number.
     * 
     * This method also sets up the time points at which subscribers are notified of regime changes (when the pacer
     * switches from one regime to the next). These notifications should always fall at the end of a complete
     * breath (including the post-exhale hold, if specified). Because the regimes may be slightly longer or shorter
     * than requested the notification will not come exactly at the end of the *requested* regime but instead
     * when the regime *actually* ends. The notification includes the description of the *requested* regime, however.
     * 
     * @param regimes 
     */
    static regimesToInstructions(regimes: BreathPacerRegime[]): { points: BreathPacerPoint[], boundaries: {boundary: number, regime:BreathPacerRegime}[] } {
        const points = [{t: 0, h: 0}];
        const boundaries: {boundary:number, regime:BreathPacerRegime}[] = [];
        let curBoundary = 0;

        regimes.forEach(r => {
            BreathPacerUtilities.validateRegime(r);
            const segmentsPerBreath = r.holdPos ? 3 : 2;
            const msPerBreath = (60 / r.breathsPerMinute) * 1000;
            const baseSegmentDur = msPerBreath / segmentsPerBreath;
            let segmentDur: () => number;
            if (r.randomize) {
                // per spec, range should be +/- 2 seconds of total breath length in increments of 0.1 seconds
                const msPerSegmentRange = BreathPacerUtilities.makeRange(baseSegmentDur - (2000 / segmentsPerBreath), baseSegmentDur + (2000 / segmentsPerBreath), (100 / segmentsPerBreath));
                segmentDur = () => {
                    const rand = Math.floor(Math.random() * msPerSegmentRange.length);
                    return msPerSegmentRange[rand];
                }
            } else {
                segmentDur = () => baseSegmentDur;
            }

            let curRegimeActualDuration = 0;
            let totalTime = 0;
            const startTime = points[points.length - 1].t;
            while (totalTime < r.durationMs) {
                const index = points.length;
                let t = points[index - 1].t + segmentDur();
                points.push({t, h:1}); // always start with inhale
                if (r.holdPos === 'postInhale') {
                    t = t + segmentDur();
                    points.push({t, h:1});
                }
                t = t + segmentDur();
                points.push({t, h: 0}); // now exhale
                if (r.holdPos === 'postExhale') {
                    t = t + segmentDur();
                    points.push({t, h:0});
                }
                totalTime = t - startTime;
            }
            curRegimeActualDuration = points[points.length - 1].t - curBoundary;
            boundaries.push({boundary: curBoundary, regime: r})
            curBoundary += curRegimeActualDuration;
        });

        return { points: points, boundaries: boundaries };
    }
}


interface BreathPacerPoint {
    t: number;
    h: number;
}


/**
 * A "regime" is a period of time when a participant should breathe at a give pace,
 * with certains options, such as whether they should pause after inhaling/exhaling.
 */
export interface BreathPacerRegime {
    durationMs: number;
    breathsPerMinute: number; // if hold is false, inhale and exhale are equal amounts of time. If hold is true, inhale, hold and exhale are all equal amounts of time
    holdPos?: "postInhale" | "postExhale";
    randomize: boolean; // if true, duration of inhale, exhale and hold (if set) are randoomly selected from a distribution that should cause the average breaths per minute to be as specified. If false, inhale/exhale/hold (if set) duration are fixed.
}


export interface BreathPacerConfig {
    audioInhaleUrl?: string,
    audioExhaleUrl?: string,
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
