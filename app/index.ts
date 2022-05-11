import "./index.css";
import { BreathPacer, BreathPacerRegime, utils } from "../src/index";

const DEFAULT_INSTRUCTIONS: BreathPacerRegime[] = [
    {durationMs: 12000, breathsPerMinute: 10, randomize: false},
    {durationMs: 12000, breathsPerMinute: 10, randomize: true},
    {durationMs: 12000, breathsPerMinute: 10, holdPos: 'postInhale', randomize: false},
    {durationMs: 12000, breathsPerMinute: 10, holdPos: 'postExhale', randomize: true},
];

const bp = new BreathPacer(
    document.getElementById("bp-canvas") as HTMLCanvasElement,
    DEFAULT_INSTRUCTIONS,
);

function logRegimeChange(bpr: BreathPacerRegime) {
    console.debug(`Starting regime`);
    console.debug(bpr);
}

bp.subscribeToRegimeChanges(logRegimeChange);

document.getElementById("bp-load")!.addEventListener("change", (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) { return; }
    const reader = new FileReader();
    reader.onload = (e: Event) => {
        try {
            const instructions = utils.parseInstructionsCSV(reader.result as string);
            bp.setInstructions(instructions);
        } catch (e) {
            console.error(e);
        }
    };
    reader.readAsText(f);
});

document.getElementById("bp-start")!.addEventListener("click", async () => {
    await bp.start();
    console.log("resolved");
});

document.getElementById("bp-pause")!.addEventListener("click", () => {
    bp.pause();
});

document.getElementById("bp-resume")!.addEventListener("click", () => {
    bp.resume();
});
