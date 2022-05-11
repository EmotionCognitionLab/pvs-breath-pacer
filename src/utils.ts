import { BreathPacerRegime } from "./BreathPacer";

export function parseInstructionsCSV(text: string): BreathPacerRegime[] {
    return text.trim().split("\n").map((line: string): BreathPacerRegime => {
        if ((line.match(/,/g) ?? []).length != 3) {
            throw new Error(`line "${line}" does not contain exactly three commmas`);
        }
        const [durString, bpmStr, holdPos, randStr] = line.split(",").map(s => s.trim());
        const durationMs = parseInt(durString, 10);
        if (Number.isNaN(durationMs) || durationMs < 0) {
            throw new Error(`failed to parse nonnegative numeric duration from "${durString}"`);
        }
        const breathsPerMinute = parseInt(bpmStr, 10);
        if (Number.isNaN(breathsPerMinute) || breathsPerMinute < 0) {
            throw new Error(`failed to parse nonnegative numeric breaths per minute from "${bpmStr}"`);
        }

        if (holdPos !== "postInhale" && holdPos !== "postExhale" && holdPos !== "") {
            throw new Error(`The hold position "${holdPos}" must be "postInhale" or "postExhale" (or be left blank).`);
        }

        if (randStr !== "true" && randStr !== "false") {
            throw new Error(`The randomize parameter ${randStr} should be either 'true' or 'false'.`);
        }

        const randomize = randStr === 'true' ? true : false;

        if (holdPos !== "") {
            return {durationMs: durationMs, breathsPerMinute: breathsPerMinute, holdPos: holdPos, randomize: randomize};
        }
        return {durationMs: durationMs, breathsPerMinute: breathsPerMinute, randomize: randomize};;
    });
}
