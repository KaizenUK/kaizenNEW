import { useState } from "react";
import { Button } from "./base/buttons/button";

/** Temporary interaction check, removed with /ui-test/ in F-02. */
export function ButtonPreview() {
  const [clicked, setClicked] = useState(false);
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <h2 className="mb-6 font-display text-3xl leading-tight text-uui-dark">
        Try the buttons.
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" onPress={() => setClicked(true)}>
          Try this button
        </Button>
        <Button color="secondary" size="lg" isDisabled>
          Not available
        </Button>
        <Button size="lg" isLoading showTextWhileLoading>
          Saving
        </Button>
      </div>
      <p role="status" className="mt-4 text-slate-600">
        {clicked ? "The button works." : "This check stays on this page."}
      </p>
    </section>
  );
}
