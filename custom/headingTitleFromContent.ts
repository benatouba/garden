import { Root, Content, Heading } from "mdast"
import { toString } from "mdast-util-to-string"

import { QuartzTransformerPlugin } from "../quartz/plugins/types"

const normalize = (value: string) =>
  value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase()

const getFirstHeadingIndex = (children: Content[]) =>
  children.findIndex((node) => node.type === "heading" && node.depth === 1)

const getHeadingText = (node: Heading) => toString(node).trim()

export const HeadingTitleFromContent: QuartzTransformerPlugin = () => ({
  name: "HeadingTitleFromContent",
  markdownPlugins() {
    return [
      () => {
        return async (tree: Root, file) => {
          const firstHeadingIndex = getFirstHeadingIndex(tree.children)
          if (firstHeadingIndex === -1) {
            return
          }

          const heading = tree.children[firstHeadingIndex] as Heading
          const headingText = getHeadingText(heading)
          if (!headingText) {
            return
          }

          const frontmatter = file.data.frontmatter ?? {
            title: file.stem ?? "Untitled",
          }
          const currentTitle = typeof frontmatter.title === "string" ? frontmatter.title : ""
          const stemTitle = typeof file.stem === "string" ? file.stem : ""

          if (!currentTitle || normalize(currentTitle) === normalize(stemTitle)) {
            frontmatter.title = headingText
          }

          file.data.frontmatter = frontmatter

          if (normalize(String(frontmatter.title)) === normalize(headingText)) {
            tree.children.splice(firstHeadingIndex, 1)

            const nextNode = tree.children[firstHeadingIndex]
            if (nextNode && nextNode.type === "thematicBreak") {
              tree.children.splice(firstHeadingIndex, 1)
            }
          }
        }
      },
    ]
  },
})
