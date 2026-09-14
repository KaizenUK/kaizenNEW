import React, { type ComponentProps } from "react";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import AssetLibrary from "./AssetLibrary";
import { builderConfig } from "./config";
import { Head } from "./shell";
import { ProjectName } from "./activeProject";

export default function AssetsView(props: ComponentProps<typeof AssetLibrary>) {
  return (
    <>
      <Head info={<ProjectName />} title="Assets" help="assets" />
      <div className="builder-page-body">
        <div className="builder-card builder-assets-card">
          <Puck
            config={builderConfig}
            data={{ content: [], root: {} }}
            onChange={() => {}}
          >
            <AssetLibrary {...props} compact={false} />
          </Puck>
        </div>
      </div>
    </>
  );
}
