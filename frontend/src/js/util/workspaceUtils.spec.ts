import { workspaceHasProcessingFiles } from './workspaceUtils';
import {
    workspaceFlatWithOneProcessing,
    workspaceFlatWithZeroProcessing,
    workspaceWithOneProcessing,
    workspaceWithOneProcessingBottomHeavyTree,
    workspaceWithTwoProcessing,
    workspaceWithZeroProcessing,
    workspaceWithZeroProcessingBottomHeavyTree
} from './workspaceUtils.fixtures';

test('workspaceHasProcessingFiles', () => {
    expect(workspaceHasProcessingFiles(workspaceWithZeroProcessing)).toBe(false);
    expect(workspaceHasProcessingFiles(workspaceWithZeroProcessingBottomHeavyTree)).toBe(false);
    expect(workspaceHasProcessingFiles(workspaceWithOneProcessing)).toBe(true);
    expect(workspaceHasProcessingFiles(workspaceWithOneProcessingBottomHeavyTree)).toBe(true);
    expect(workspaceHasProcessingFiles(workspaceWithTwoProcessing)).toBe(true);

    expect(workspaceHasProcessingFiles(workspaceFlatWithZeroProcessing)).toBe(false);
    expect(workspaceHasProcessingFiles(workspaceFlatWithOneProcessing)).toBe(true);
});
