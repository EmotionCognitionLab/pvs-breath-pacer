import "./index.css";
import { BreathPacer, BreathPacerInstruction, utils } from "../src/index";

const DEFAULT_INSTRUCTIONS: BreathPacerInstruction[] = [
    {duration: 4000, breathe: "in"},
    {duration: 4000, breathe: "hold"},
    {duration: 4000, breathe: "out"},
    {duration: 4000, breathe: "hold"},
];

const bp = new BreathPacer(
    document.getElementById("bp-canvas") as HTMLCanvasElement,
    DEFAULT_INSTRUCTIONS,
);

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

document.getElementById("bp-start")!.addEventListener("click", () => {
    bp.start();
});
