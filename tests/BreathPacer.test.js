/**
 * @jest-environment jsdom
 */


import { BreathPacer, BreathPacerUtilities } from '../src/BreathPacer';

describe("Regime validation", () => {
    test("should not allow regimes with negative durations", () => {
        expect(() => BreathPacerUtilities["validateRegime"]({durationMs: -15, breathsPerMinute: 6, randomize: false})
        ).toThrow("The minimum duration is 10000 (10 seconds).");
    });

    test("should not allow regimes shorter than 10000ms", () => {
        expect(() => BreathPacerUtilities["validateRegime"]({durationMs: 9900, breathsPerMinute: 6, randomize: false})
        ).toThrow("The minimum duration is 10000 (10 seconds).");
    });

    test("should not allow less than 2 breaths/minute", () => {
        expect(() => BreathPacerUtilities["validateRegime"]({durationMs: 15000, breathsPerMinute: 1, randomize: false})
        ).toThrow("The minimum breaths per minute is 2.");
    });

    test("should not allow more than 60 breaths/minute", () => {
        expect(() => BreathPacerUtilities["validateRegime"]({durationMs: 15000, breathsPerMinute: 61, randomize: false})
        ).toThrow("The maximum breaths per minute is 60.");
    });

    test("should not allow regimes that don't have time for at least one breath", () => {
        expect(() => BreathPacerUtilities["validateRegime"]({durationMs: 10000, breathsPerMinute: 2, randomize: false})
        ).toThrow("The minmimum number of breaths during the total duration is 1.")
    });

    test("should accept a well-formed regime", () => {
        expect(() => BreathPacerUtilities["validateRegime"]({durationMs: 30000, breathsPerMinute: 15, randomize: true})
        ).not.toThrow();
    });
});

function durationsFromPoints(points) {
    const durations = points.map((p, idx) => {
        const prevPoint = points[idx - 1] || {t: 0};
        const prevTime = prevPoint.t;
        const curTime = p.t;
        return curTime - prevTime;
    });
    durations.shift(); // first duration is 0; drop it
    return durations;
}

describe.each([
    {desc: "without randomization or holds", regime: {durationMs: 300000, breathsPerMinute: 10, randomize: false}},
    {desc: "with postInhale hold", regime: {durationMs: 300000, breathsPerMinute: 10, holdPos: 'postInhale', randomize: false}},
    {desc: "without an even number of breaths", regime: {durationMs: 10000, breathsPerMinute: 10, randomize: false}},
    {desc: "with postExhale hold", regime: {durationMs: 300000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: false}},
    {desc: "with randomization but no hold", regime: {durationMs: 300000, breathsPerMinute: 10, randomize: true}},
    {desc: "with randomization and hold", regime: {durationMs: 300000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: true}},
])("Points from a regime $desc", ({_desc, regime}) => {
    test("should always start with an inhale", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        expect(instr.points[0].h).toBe(0);
        expect(instr.points[1].h).toBe(1);
    });

    test("should always start at time 0", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        expect(instr.points[0].t).toBe(0);
    });

    test("should always end on an exhale", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const pointCount = instr.points.length;
        if (regime.holdPos === 'postExhale') {
            expect(instr.points[pointCount - 3].h).toBe(1);
            expect(instr.points[pointCount - 2].h).toBe(0);
        } else {
            expect(instr.points[pointCount - 2].h).toBe(1);
        }
        expect(instr.points[pointCount - 1].h).toBe(0);
    });

    test("should always have a whole number of breaths, even if the original regime does not", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const breathPoints = instr.points.slice(1);
        let inhales = 0
        let exhales = 0
        let holds = 0;
        if (!regime.holdPos) {
            breathPoints.forEach(p => {
                if (p.h === 0) exhales++;
                if (p.h === 1) inhales++;
            });
            expect(inhales).toEqual(exhales);
        } else {
            breathPoints.forEach((p, idx) => {
                if (regime.holdPos === 'postInhale') {
                    if (p.h === 0) exhales++;
                    if (p.h === 1) {
                        if (breathPoints[idx - 1] && breathPoints[idx - 1].h === 1) {
                            holds++;
                        } else {
                            inhales++;
                        }
                    }
                } else {
                    if (p.h === 1) inhales++;
                    if (p.h === 0) {
                        if (breathPoints[idx - 1].h === 0) {
                            holds++;
                        } else {
                            exhales++;
                        }
                    }
                }
            });
            expect(inhales).toEqual(exhales);
            expect(inhales).toEqual(holds);
        }
    });

    test("should be in the right order (inhale, exhale, inhale)", () => {
        if (regime.holdPos) return; // TODO would be nice if there were a way to mark this as skipped

        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        instr.points.forEach((p, idx) => {
            if (idx % 2 === 0) {
                expect(p.h).toBe(0);
            } else {
                expect(p.h).toBe(1);
            }
        });
    });

    test("should always be the right duration", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const points = instr.points;
        const actualDuration = points[points.length - 1].t;
        const expectedMinDuration = regime.durationMs;
        let expectedMaxDuration;
        const msPerBreath = (60 / regime.breathsPerMinute) * 1000;
        const wholeBreathsInRegime = Math.ceil(regime.durationMs / msPerBreath);
        if (regime.randomize) {
            expectedMaxDuration = wholeBreathsInRegime * (msPerBreath + 2000);
        } else {
            expectedMaxDuration = wholeBreathsInRegime * msPerBreath;
        }
        expect(actualDuration).toBeGreaterThanOrEqual(expectedMinDuration);
        expect(actualDuration).toBeLessThanOrEqual(expectedMaxDuration);
    });
});

describe("Points from any regime", () => {
    
    test("should put postInhale holds after inhales", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([{durationMs: 300000, breathsPerMinute: 10, holdPos: 'postInhale', randomize: false}]);
        instr.points.forEach((p, idx) => {
            if (p.h === 0 && idx < instr.points.length - 3) {
                expect(instr.points[idx + 1].h).toBe(1);
                expect(instr.points[idx + 2].h).toBe(1);
            }
        });
    });

    test("should put postExhale holds after exhales", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([{durationMs: 300000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: true}]);
        instr.points.forEach((p, idx) => {
            if (p.h === 1 && idx < instr.points.length - 3) {
                expect(instr.points[idx + 1].h).toBe(0);
                expect(instr.points[idx + 2].h).toBe(0);
            }
        });
    });
    
});

describe("Points from a non-random regime", () => {
    test("should have inhalations, exhalations and holds that are all the same length", () => {
        const instr = BreathPacerUtilities.regimesToInstructions([{durationMs: 60000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: false}]);
        const durations = durationsFromPoints(instr.points);
        const firstDur = durations[0];
        expect(durations.every(d => d === firstDur)).toBe(true);
    });
});

function expectedSegmentDuration(regime) {
    const secsPerBreath = 60 / regime.breathsPerMinute;
    const totalBreaths = regime.durationMs / (secsPerBreath * 1000);
    const segmentsPerBreath = regime.holdPos ? 3 : 2;
    return regime.durationMs / totalBreaths / segmentsPerBreath;
}

function testMinimumDurationDiffs(regime, expectedDiff) {
    const instr = BreathPacerUtilities.regimesToInstructions([regime]);
    const durations = durationsFromPoints(instr.points);
    const standardDuration = expectedSegmentDuration(regime);
    const durationDiffs = durations.map(dur => Math.abs(dur - standardDuration));
    expect(durationDiffs.every(diff => diff === 0 || diff >= expectedDiff)).toBe(true);
}

describe("Building points from a random regime", () => {
    test("should have times drawn from a range of +/- 1 second (without holds) around the inhale/exhale time for a non-random regine", () => {
        const regime = {durationMs: 300000, breathsPerMinute: 10, randomize: true};
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const durations = durationsFromPoints(instr.points);
        const expectedInhaleExhaleDuration = expectedSegmentDuration(regime);
        expect(durations.every(d => d >= expectedInhaleExhaleDuration - 1000 && d <= expectedInhaleExhaleDuration + 1000)).toBe(true);
    });

    test("should have times drawn from a range of +/- 0.66 seconds (with holds) around the inhale/exhale time for a non-random regine", () => {
        const regime = {durationMs: 300000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: true};
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const durations = durationsFromPoints(instr.points);
        const expectedSegmentMs = expectedSegmentDuration(regime);
        expect(durations.every(d => d >= expectedSegmentMs - 667 && d <= expectedSegmentMs + 667)).toBe(true);
    });

    test("should have times that are either 0 ms or no less than 50ms apart (without holds)", () => {
        const regime = {durationMs: 300000, breathsPerMinute: 10, randomize: true};
        testMinimumDurationDiffs(regime, 50);
    });

    test("should have times that are either 0 ms or no less than 32ms apart (with holds)", () => {
        const regime = {durationMs: 300000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: true};
        testMinimumDurationDiffs(regime, 32);
    });

    test("should produce an average breath duration (over a five minute session) that is within 0.5s of the bpm given in the regime", () => {
        const regime = {durationMs: 300000, breathsPerMinute: 10, randomize: true};
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const segmentsPerBreath = regime.holdPos ? 3 : 2;
        const expectedBreathDuration = expectedSegmentDuration(regime) * segmentsPerBreath;
        const breathCount = instr.points.filter(p => p.h === 1).length;
        const avgBreathDuration = instr.points[instr.points.length - 1].t / breathCount;
        expect(Math.abs(expectedBreathDuration - avgBreathDuration)).toBeLessThanOrEqual(500);
    });

    test("should produce a duration that is within one full breath length of the duration given in the regime", () => {
        const regime = {durationMs: 300000, breathsPerMinute: 10, randomize: true};
        const segmentsPerBreath = regime.holdPos ? 3 : 2;
        const expectedBreathDuration = expectedSegmentDuration(regime) * segmentsPerBreath;
        const instr = BreathPacerUtilities.regimesToInstructions([regime]);
        const actualDuration = instr.points[instr.points.length - 1].t;
        expect(Math.abs(regime.durationMs - actualDuration)).toBeLessThanOrEqual(expectedBreathDuration);
    });
});

describe.each([
    {
        desc: "non-random regimes without holds",
        regimes: [ {durationMs: 300000, breathsPerMinute: 10, randomize: false}, {durationMs: 100000, breathsPerMinute: 7, randomize: false} ]
    },
    {
        desc: "non-random regimes with holds",
        regimes: [ {durationMs: 300000, breathsPerMinute: 10, holdPos: "postInhale", randomize: false}, {durationMs: 100000, breathsPerMinute: 7, holdPos: "postExhale", randomize: false} ]
    },
    {
        desc: "mixed random and non-random regimes",
        regimes: [ {durationMs: 200000, breathsPerMinute: 10, randomize: true}, {durationMs: 100000, breathsPerMinute: 7, randomize: false} ]
    },
    {
        desc: "random regimes without holds",
        regimes: [ {durationMs: 300000, breathsPerMinute: 10, randomize: true}, {durationMs: 150000, breathsPerMinute: 7, randomize: true} ]
    },
    {
        desc: "random regimes with holds",
        regimes: [ {durationMs: 300000, breathsPerMinute: 10, holdPos: "postExhale", randomize: true}, {durationMs: 150000, breathsPerMinute: 7, holdPos: "postInhale", randomize: true} ]
    },
    {
        desc: "mixed regimes with holds",
        regimes: [ {durationMs: 300000, breathsPerMinute: 10, holdPos: "postExhale", randomize: true}, {durationMs: 150000, breathsPerMinute: 7, holdPos: "postInhale", randomize: false} ]
    },
    {
        desc: "several regimes",
        regimes: [ {durationMs: 150000, breathsPerMinute: 10, holdPos: "postInhale", randomize: true}, {durationMs: 300000, breathsPerMinute: 12, randomize: true}, {durationMs: 300000, breathsPerMinute: 15, holdPos: "postExhale", randomize: true}, {durationMs: 200000, breathsPerMinute: 10, randomize: true} ]
    }
])("Regime transition boundaries for instructions with $desc", ({_desc, regimes}) => {
    test("should have the first boundary at time 0", () => {
        const instr = BreathPacerUtilities.regimesToInstructions(regimes);
        expect(instr.boundaries[0].boundary).toBe(0);
    });

    test("should have the regimes in the order they were provided", () => {
        const instr = BreathPacerUtilities.regimesToInstructions(regimes);
        instr.boundaries.forEach((b, idx) => {
            expect(b.regime).toEqual(regimes[idx]);
        });
    });

    test("should have boundaries that are <= (1 breath duration * number of previous regimes) from the specified transitions", () =>{
        const expectedTransitions = regimes.reduce((prev, cur, idx) => {
            const prevDuration = prev[idx - 1] || 0;
            prev.push(cur.durationMs + prevDuration);
            return prev;
        }, []);
        const instr = BreathPacerUtilities.regimesToInstructions(regimes);
        const actualTransitions = instr.boundaries.map(b => b.boundary);
        expect(actualTransitions.length).toBe(expectedTransitions.length);

        const maxBreathExtensions = regimes.map(r => {
           const breathDur = ( 60 / r.breathsPerMinute) * 1000;
           return r.randomize ? breathDur + 2000 : breathDur;
        }).reduce((prev, cur, idx) => {
            const prevDur = prev[idx - 1] || 0;
            prev.push(cur + prevDur);
            return prev;
        }, []);

        instr.boundaries.slice(1).forEach((b, idx) => {
            expect(b.boundary).toBeGreaterThanOrEqual(expectedTransitions[idx]);
            expect(b.boundary).toBeLessThanOrEqual(expectedTransitions[idx] + maxBreathExtensions[idx]);
        });
    });
});

describe("Should notify on regime change", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => setTimeout(() => cb(performance.now()), 100));
    });
    
    afterEach(() => {
        window.requestAnimationFrame.mockRestore();
        jest.clearAllTimers();
    });

    test("when running after calling start()", () => {
        const regimes = [ 
            {durationMs: 15000, breathsPerMinute: 10, holdPos: "postInhale", randomize: true},
            {durationMs: 20000, breathsPerMinute: 12, randomize: true},
            {durationMs: 30000, breathsPerMinute: 15, holdPos: "postExhale", randomize: true},
            {durationMs: 20000, breathsPerMinute: 10, randomize: true}
        ];
        const canvas = document.createElement('canvas');
        const bp = new BreathPacer(canvas, regimes);
        const notifications = [];
        const logNotification = (time, regime) => notifications.push({timePoint: time, regime: regime});
        bp.subscribeToRegimeChanges(logNotification);
        bp.start();
        const totalTime = regimes.reduce((prev, cur) => prev + cur.durationMs, 0);
        jest.advanceTimersByTime(totalTime);
        expect(notifications.length).toBe(regimes.length);
        notifications.forEach((n, idx) => {
            expect(n.regime).toEqual(regimes[idx]);
        });
        const runningDurationSum = regimes.reduce((prev, cur, idx) => {
            const prevDuration = prev[idx - 1] || 0;
            prev.push(cur.durationMs + prevDuration);
            return prev;
        }, []);
        runningDurationSum.splice(0,0,0);
        runningDurationSum.pop();
        notifications.forEach((n, idx) => expect(n.timePoint).toBeGreaterThanOrEqual(runningDurationSum[idx]));
    });
});