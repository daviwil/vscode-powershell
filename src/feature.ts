/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { LanguageClient } from 'vscode-languageclient';
export { LanguageClient } from 'vscode-languageclient';
import { ISessionManager } from './session';

export interface IFeature extends vscode.Disposable {
    constructor(sessionManager: ISessionManager);
    dispose();
}
