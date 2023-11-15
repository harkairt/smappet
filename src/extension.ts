// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// import mustache
import * as Mustache from "mustache";
import {
  camelCase,
  capitalCase,
  constantCase,
  dotCase,
  headerCase,
  paramCase,
  pascalCase,
  pathCase,
  snakeCase,
} from "change-case";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  context.subscriptions.push(
    vscode.commands.registerCommand("smappet.copy", async () => {
      let variableString = await getTemplateVariableNames();
      let variables = variableString?.split(",").map((variable) => variable.trim());

      let selectedText = await getSelectedText();
      let mustacheEmbedded = replaceVariablesWithMustache(selectedText, variables, [
        camelCase,
        pascalCase,
        capitalCase,
        constantCase,
        dotCase,
        headerCase,
        paramCase,
        pathCase,
        snakeCase,
      ]);

      if (mustacheEmbedded !== undefined) {
        await vscode.env.clipboard.writeText(mustacheEmbedded);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("smappet.paste", async function () {
      const clipboardText = await vscode.env.clipboard.readText();
      const variableNames = getVariableNames(clipboardText);
      const newVariableValues = await getTemplateVariableValues(variableNames);
      const replaced = replaceKeysWithValues(clipboardText, arrayToObject(variableNames, newVariableValues));
      const processedText = await mustacheProcess(replaced);

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor.edit((editBuilder) => {
          const position = editor.selection.active;

          editBuilder.insert(position, processedText);
        });
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function getTemplateVariableNames(): Promise<String | undefined> {
  return await vscode.window.showInputBox({
    prompt: "Comma separated list of camelCase variable names to pick up",
    placeHolder: "variableNames, toPickUp",
  });
}

function replaceKeysWithValues(text: string, obj: { [key: string]: string }): string {
  for (let key in obj) {
    let value = obj[key];
    let keyRegExp = new RegExp(key, "g");
    text = text.replace(keyRegExp, value);
  }
  return text;
}

function getVariableNames(text: string): string[] {
  const regex = /{{#.*?}}(.*?){{\/.*?}}/g;
  let match;
  let variables = new Set<string>();
  while ((match = regex.exec(text))) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

async function getTemplateVariableValues(variableNames: string[]): Promise<string[]> {
  const values = await vscode.window.showInputBox({
    prompt: "Comma separated list of replacement values.",
    placeHolder: `New values for ${variableNames.join(", ")}`,
  });

  return values?.split(",") ?? [];
}

async function getSelectedText(): Promise<string | undefined> {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let selection = editor.selection;
  let text = editor.document.getText(selection);

  return text;
}

async function mustacheProcess(text: string): Promise<string> {
  var view = {
    camelCase: () => (text: any, render: any) => camelCase(render(text)),
    capitalCase: () => (text: any, render: any) => capitalCase(render(text)),
    constantCase: () => (text: any, render: any) => constantCase(render(text)),
    dotCase: () => (text: any, render: any) => dotCase(render(text)),
    headerCase: () => (text: any, render: any) => headerCase(render(text)),
    pascalCase: () => (text: any, render: any) => pascalCase(render(text)),
    paramCase: () => (text: any, render: any) => paramCase(render(text)),
    snakeCase: () => (text: any, render: any) => snakeCase(render(text)),
  };

  return Mustache.render(text, view);
}

function arrayToObject(keys: string[], values: string[]): { [key: string]: string } {
  let obj: { [key: string]: string } = {};
  for (let i = 0; i < keys.length; i++) {
    obj[keys[i]] = values[i];
  }
  return obj;
}

function replaceVariablesWithMustache(
  text: string | undefined,
  variables: string[] | undefined,
  casings: ((input: string, options?: import("no-case").Options | undefined) => string)[]
): string | undefined {
  if (text === undefined || variables === undefined) {
    return;
  }

  let mustacheEmbedded = text;

  variables.forEach((variable, index) => {
    casings.forEach((casing) => {
      mustacheEmbedded = replaceIfNotWrapped(
        mustacheEmbedded,
        casing(variable),
        `{{#${casing.name}}}${variable}{{/${casing.name}}}`
      );
    });
  });

  return mustacheEmbedded;
}

function replaceIfNotWrapped(str: string, oldValue: string, newValue: string): string {
  const escapedOldValue = oldValue.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<!}})${escapedOldValue}(?!{{)`, "g");
  return str.replace(regex, newValue);
}
