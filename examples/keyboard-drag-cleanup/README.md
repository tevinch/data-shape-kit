# React Aria keyboard drag cleanup: withdrawn

This recipe was withdrawn on September 13, 2026. Do not apply the former patch as a fix for [React Spectrum issue #10599](https://github.com/adobe/react-spectrum/issues/10599).

The requested workflow is to keep moving a child after collapsing its parent folder. The former patch cancelled the drag when the source row unmounted. Restarting required showing the source again, so it did not satisfy that workflow. Restoring page input after cancellation was insufficient.

The previously reported results came from scripted Playwright runs. There is no human manual validation to report for this recipe. Pointer, touch, native assistive technology, and screen-reader behavior were not tested. The shared `DragManager` also serves virtual interaction, so keyboard tests did not establish that other interaction modes were unaffected.

The generated runtime patch was also difficult to review upstream. The installer, patch, runnable fixture, and active collection entry have been removed. This withdrawal does not fix the upstream issue or establish that a replacement is available; follow the upstream discussion for its status.

If you applied the former patch, restore your application's original lockfile and reinstall its dependencies. For an npm project:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

Reinstallation restores the locked package bytes and removes the manual patch. This does not resolve the original React Aria behavior.

The original [fixture license](LICENSE) and [upstream license](UPSTREAM-LICENSE) remain available for reference.
