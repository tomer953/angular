/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import url from 'url';

const containingDir = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * Verify that we are looking at a test class declaration (a given file might have multiple class
 * declarations).
 */
function isTestClass(classDeclaration: ts.ClassDeclaration): boolean {
  return classDeclaration.name !== undefined && classDeclaration.name.text.endsWith('Test');
}

function testFile(
    testFileName: string, getType: (v: string) => string, inferWriteType: boolean): boolean {
  const fileContent = fs.readFileSync(path.join(containingDir, `${testFileName}.d.ts`), 'utf8');
  const sourceFile = ts.createSourceFile('test.ts', fileContent, ts.ScriptTarget.ESNext, true);
  const testClazz = sourceFile.statements.find(
      (s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && isTestClass(s));

  if (testClazz === undefined) {
    return false;
  }

  let failing = false;
  for (const member of testClazz.members) {
    if (!ts.isPropertyDeclaration(member)) {
      continue;
    }

    const leadingCommentRanges = ts.getLeadingCommentRanges(sourceFile.text, member.getFullStart());
    const leadingComments = leadingCommentRanges?.map(r => sourceFile.text.substring(r.pos, r.end));

    if (leadingComments === undefined || leadingComments.length === 0) {
      throw new Error(`No expected type for: ${member.name.getText()}`);
    }

    // strip comment start, and beginning (plus whitespace).
    const expectedTypeComment = leadingComments[0].replace(/(^\/\*\*?\s*|\s*\*+\/$)/g, '');
    const expectedType = getType(expectedTypeComment);
    // strip excess whitespace or newlines.
    const got = member.type?.getText().replace(/(\n+|\s\s+)/g, '');

    if (expectedType !== got) {
      console.error(`${member.name.getText()}: expected: ${expectedType}, got: ${got}`);
      failing = true;
    }
  }

  return failing;
}

async function main() {
  let failing = false;

  failing ||= testFile(
      'signal_input_signature_test',
      v => v.includes(',') ? `InputSignalWithTransform<${v}>` : `InputSignal<${v}>`, true);

  if (failing) {
    throw new Error('Failing assertions');
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
