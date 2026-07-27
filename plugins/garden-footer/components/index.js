import { readFileSync } from "node:fs"
import { join } from "node:path"
import { h } from "preact"

const quartzVersion = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")).version

const style = `
footer {
  text-align: left;
  margin-bottom: 4rem;
  opacity: 0.7;
}

footer ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  margin-top: -1rem;
}
`

const externalProps = { target: "_blank", rel: "noopener noreferrer" }

export const Footer = (userOpts = {}) => {
  const links = userOpts.links ?? {}

  const GardenFooter = () => {
    const year = new Date().getFullYear()
    return h("footer", null, [
      h("hr", { key: "hr" }),
      h("p", { key: "attribution" }, [
        "Created with ",
        h(
          "a",
          { href: "https://quartz.jzhao.xyz/", ...externalProps, key: "quartz" },
          `Quartz v${quartzVersion}`,
        ),
        ` © ${year}`,
      ]),
      h(
        "ul",
        { key: "links" },
        Object.entries(links).map(([text, link]) =>
          h("li", { key: link }, [h("a", { href: link, ...externalProps }, text)]),
        ),
      ),
    ])
  }

  GardenFooter.css = style
  return GardenFooter
}

export default { Footer }
