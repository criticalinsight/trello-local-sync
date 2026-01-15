import { Component, For, createMemo } from 'solid-js';
import * as Diff from 'diff';

interface VersionDiffProps {
    oldText: string;
    newText: string;
    mode?: 'chars' | 'words' | 'lines';
}

export const VersionDiff: Component<VersionDiffProps> = (props) => {
    const diffs = createMemo(() => {
        const mode = props.mode || 'words';
        if (mode === 'chars') {
            return Diff.diffChars(props.oldText || '', props.newText || '');
        } else if (mode === 'lines') {
            return Diff.diffLines(props.oldText || '', props.newText || '');
        }
        return Diff.diffWords(props.oldText || '', props.newText || '');
    });

    return (
        <div class="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            <For each={diffs()}>
                {(part) => (
                    <span
                        class={
                            part.added
                                ? 'bg-emerald-900/50 text-emerald-200 px-0.5 rounded'
                                : part.removed
                                    ? 'bg-red-900/50 text-red-200 px-0.5 line-through decoration-red-500/50 opacity-70'
                                    : 'text-slate-300'
                        }
                    >
                        {part.value}
                    </span>
                )}
            </For>
        </div>
    );
};
