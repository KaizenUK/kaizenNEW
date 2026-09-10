# Your builder acceptance checks

Open `/builder/` on the deployed site once the deployment/CI work is complete. Local development uses the same path on the Astro development server.

## Check your assets and editing

1. Import a UI8 ZIP or folder into a named pack. Check the expected file count, filenames, folder paths and any supplied licences. Reimport the same pack: it should skip duplicates.
2. Search for an image, add it to a page, and check its appearance against the original. Test an SVG and a font if supplied. GIFs retain animation; sanitised SVGs are static. Source code, Lottie JSON, videos and design references do not automatically become working blocks.
3. Change text, spacing and the mobile layout. Undo and redo a change. Save, close the editor and reopen the page: the changes should remain.
4. Reuse a shared header/footer on three pages. Edit its shared definition and check all assigned drafts. Check that an intentional instance override survives.
5. Download an editable project backup. Restore it, review the result and confirm the pages, assets and shared content are editable. Restore a page revision and confirm it changes the draft only.

Import limits are 50 MB per file, 250 MB per ZIP, 500 MB expanded per batch and 2,000 files. Extract a larger ZIP and upload smaller folders/batches. A single oversized design file needs smaller exports or developer-assisted conversion; splitting its archive does not make the file itself supported.

## After deployment/CI is fixed

6. Sign in with an editor account, save and reopen a page in a second browser. Check uploads persist. Confirm a signed-out visitor and a non-editor account cannot open the editor's private workspace.
7. Create a private preview. Confirm it opens for another authorised editor, requires sign-in, and stops opening after revocation. Forms must not submit from previews.
8. Publish a test page. Wait for **Live**, then check the public URL in a private browser window. Change its draft and confirm the live version stays unchanged until another publication.
9. Submit one clearly labelled test enquiry on the published page. Check the stored enquiry and the existing alert/delivery destination. An editor preview or a stored enquiry alone does not prove email delivery.
10. On staging, test a redirect, unpublishing, a failed release retaining the previous site, and rollback restoring the prior public page. Confirm newer drafts survive rollback. Also build an exported React project independently; configure its form receiver before testing submissions.

Real hosted verification and deployment/CI repair are deferred at your request. Local results and exact asset compatibility findings are recorded in [the builder guide](visual-builder.md).
