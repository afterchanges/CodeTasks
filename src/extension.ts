import * as vscode from 'vscode';

interface Task {
	file: string
	line: number
	text: string
}

let completedTasks: number = 0;

export function activate(context: vscode.ExtensionContext) {
	console.log('Code tasks extension activated!')
	const disposable = vscode.commands.registerCommand('codetasks.showPanel', () => {
		createWebView(context);
		vscode.window.showInformationMessage('Code Tasks Panel is now active!');
	});

	context.subscriptions.push(disposable);
}

function createWebView(context: vscode.ExtensionContext) {
	const panel = vscode.window.createWebviewPanel(
		'codetasks',
		'CodeTasks',
		vscode.ViewColumn.One,
		{ enableScripts: true }
	);

	const tasks = findComments();
	panel.webview.html = getHtmlContent(tasks);

	// Обработка сообщений от WebView
	panel.webview.onDidReceiveMessage((message) => {
		if (message.command === 'goTo') {
			goToComment(message.file, message.line);
		} else if (message.command === 'complete') {
			completedTasks++;
			const updatedTasks = tasks.filter(
				(task) => !(task.file === message.file && task.line === message.line)
			);
			panel.webview.html = getHtmlContent(updatedTasks);
		}
	});
}

function findComments(): Task[] {
	const comments: Task[] = [];
	const editor = vscode.window.activeTextEditor;

	if (editor) {
		const document = editor.document;
		const text = document.getText();
		const regex = /(TODO|FIXME):\s*(.*)/g;

		let match;
		while ((match = regex.exec(text)) !== null) {
			const line = document.positionAt(match.index).line;
			comments.push({
				file: document.fileName,
				line: line + 1,
				text: match[2].trim(),
			});
		}
	}
	return comments;
}

function goToComment(file: string, line: number) {
	vscode.workspace.openTextDocument(file).then((doc) => {
		vscode.window.showTextDocument(doc).then((editor) => {
			const position = new vscode.Position(line - 1, 0);
			const range = new vscode.Range(position, position);
			editor.selection = new vscode.Selection(position, position);
			editor.revealRange(range);
		});
	});
}

function getHtmlContent(tasks: Task[]): string {
	const taskItems = tasks
		.map(
			(task) =>
				`<div class="task">
                    <strong>${task.file}</strong> (Line ${task.line}): ${task.text}
                    <button onclick="goTo('${task.file}', ${task.line})">Go To</button>
                    <button onclick="complete('${task.file}', ${task.line})">Complete</button>
                </div>`
		)
		.join('');

	return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; padding: 10px; }
            .task { margin-bottom: 10px; padding: 5px; border: 1px solid #ccc; }
            .task button { margin-left: 10px; }
        </style>
    </head>
    <body>
        <h2>CodeTasks</h2>
        <p>Completed tasks: ${completedTasks}</p>
        <div id="tasks">${taskItems || '<p>No tasks found.</p>'}</div>
        <script>
            const vscode = acquireVsCodeApi();

            function goTo(file, line) {
                vscode.postMessage({ command: 'goTo', file, line });
            }

            function complete(file, line) {
                vscode.postMessage({ command: 'complete', file, line });
            }
        </script>
    </body>
    </html>`;
}
