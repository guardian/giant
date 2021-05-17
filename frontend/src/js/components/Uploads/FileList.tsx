import React, { useState } from 'react';
import { MenuChevron } from '../UtilComponents/MenuChevron';
import { Loader, Icon, Button, Message } from 'semantic-ui-react';
import { UploadFile } from './UploadFiles';

// Returns an array containing all the intermediate paths of the files,
// e.g. ['/path/to/file.pdf'] => ['/path', /path/to', '/path/to/file.pdf']
// Filters out any paths under collapsed portions.
function buildTree(files: string[], collapsed: string[]): string[] {
    const paths = files.sort();
    const ret = new Set<string>();

    for(const path of paths) {
        const parts = path.split("/");
        let acc = "";

        for(const part of parts) {
            acc = acc === "" ? part : acc + "/" + part;
            ret.add(acc);
        }
    }

    return Array.from(ret).filter(path =>
        !collapsed.some(prefix =>
            path.startsWith(prefix) && path !== prefix
        )
    );
}

function collapseToDepth(files: string[], depth: number): Set<string> {
    const ret = files.reduce((acc, path) => {
        const parts = path.split("/");

        if(parts.length > depth) {
            acc.add(parts.slice(0, depth).join("/"));
        }

        return acc;
    }, new Set<string>());

    return ret;
}

function StatusIcon({ path, files }: { path: string, files: Map<string, UploadFile> }) {
    const allUnderPath = Array.from(files.entries()).filter(([p])=> p.startsWith(path));

    const anyFailed = allUnderPath.some(([, { state }]) => state.description === 'failed');
    if(anyFailed) {
        return <Icon name="exclamation triangle" size="tiny" color="red" />;
    }

    const anyUploading = allUnderPath.some(([, { state }]) => state.description === 'uploading');
    if(anyUploading) {
        return <Loader active inline size="tiny" />;
    }

    const allUploaded = allUnderPath.every(([, { state }]) => state.description === 'uploaded');
    if(allUploaded) {
        return <Icon name="check" size="tiny" />;
    }

    return <React.Fragment />;
}

function updateCollapsed(path: string, isCollapsed: boolean, collapsed: Set<string>): Set<string> {
    const ret = new Set([...collapsed]);

    if(isCollapsed) {
        ret.add(path);
    } else {
        ret.delete(path);
    }

    return ret;
}

export default function FileList({ files, disabled, removeByPath }: { files: Map<string, UploadFile>, disabled: boolean, removeByPath: (path: string) => void }) {
    // Differentiate between manually expanding everything vs a default collapse in a new instance
    const [userCollapsed, setUserCollapsed] = useState<Set<string> | null>(null);

    const filePaths = [...files.keys()];
    const defaultCollapse = collapseToDepth(filePaths, 2);

    const collapsed = userCollapsed || defaultCollapse;

    const filesAndFolders = buildTree(filePaths, Array.from(collapsed));

    const anyFailed = [...files.values()].some(({ state }) => state.description === 'failed');

    return (
        <React.Fragment>
            <div className="upload-dialog__file-browser">
                <table className='file-browser'>
                    <tbody>
                        {filesAndFolders.map(path => {
                            const parts = path.split("/");
                            const depth = parts.length - 1;

                            const name = parts[depth];

                            const isCollapsed = collapsed.has(path);
                            const isLeaf = !files.has(path);

                            return <tr className="file-browser__entry" key={path}>
                                <td className='file-browser__cell'>
                                    {[...Array(depth)].map((m, i) => <span key={i} className='file-browser__name-pad'></span>)}
                                    {isLeaf ? <MenuChevron onClick={() => setUserCollapsed(updateCollapsed(path, !isCollapsed, collapsed))} expanded={!isCollapsed} /> : false}
                                    {name}
                                    <React.Fragment>
                                        <span className='file-browser__name-pad'></span>
                                        <StatusIcon path={path} files={files} />
                                    </React.Fragment>
                                    {!disabled ?
                                        <Button icon size="mini" compact floated="right" color="grey" onClick={() => removeByPath(path)}>
                                            <Icon name="close" />
                                        </Button> : false}
                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
            {anyFailed ?
            <Message negative>
                <Message.Header>Some uploads failed</Message.Header>
                <p>Please contact your administrator</p>
            </Message> : false}
        </React.Fragment>
    );
}
