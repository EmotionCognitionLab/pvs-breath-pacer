import "./index.css";
import { BreathPacer, BreathPacerInstruction, parseInstructions } from "../src/index";

const DEFAULT_INSTRUCTIONS: BreathPacerInstruction[] = [
    {duration: 2000, breathe: "in"},
    {duration: 2000, breathe: "out"},
    {duration: 4000, breathe: "in"},
    {duration: 2000, breathe: "hold"},
    {duration: 5000, breathe: "out"},
];

const bp = new BreathPacer({
    canvas: document.getElementById("bp-canvas"),
    instructions: DEFAULT_INSTRUCTIONS,
});

document.getElementById("bp-load")!.addEventListener("change", (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) { return; }
    const reader = new FileReader();
    reader.onload = (e: Event) => {
        const instructions = parseInstructions(reader.result as string);
        if (instructions === null) { return; }
        bp.set({instructions});
    };
    reader.readAsText(f);
});

document.getElementById("bp-start")!.addEventListener("click", () => {
    bp.start();
});
