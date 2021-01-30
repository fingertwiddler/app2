import Handlebars from "https://jspm.dev/handlebars"
import marked from "https://jspm.dev/marked"
import matter from "https://jspm.dev/gray-matter"
export class Builder {
  constructor(o) {
    this.config = o.config
//    this.modules = o.modules
    this.src = o.src
    this.fs = o.fs
    this.git = o.git
  }
  /***********************************************************************
  *
  * Input:
  *   - content filename
  *   - theme filename
  *
  * Output:
  *   - jjj
  ***********************************************************************/
  async processImages(o, config) {
    let re = /(?:!\[(.*?)\]\((.*?)\))/g
    let matches = o.content.matchAll(re)
    for(let m of matches) {
      let url = m[2]
      let match = /assets\/(.+)$/.exec(url)
      if (match && match.length > 0) {
        let b = await this.fs.promises.readFile(`${config.SRC}/assets/${match[1]}`)
        await this.fs.promises.writeFile(`${config.DEST}/assets/${match[1]}`, b)
      }
    }
  }
  async processContent(o, config) {
    // Build full HTML page for the post and write to DEST
    let theme = await this.fs.promises.readFile(config.THEME.POST, "utf8")
    let template = Handlebars.compile(theme)
    let rendered = template({
      name: config.NAME,
      content: o.html,
      updated: o.data.updated,
      filename: `${config.SRC}/${o.filename}`,
      title: o.data.title
    }).trim()
    await this.fs.promises.mkdir(`${config.DEST}/${o.filename}`).catch((e) => { })
    await this.fs.promises.writeFile(`${config.DEST}/${o.filename}/index.html`, rendered)
  }
  async buildPost (filename, config) {
    // parse markdown metadata
    let md = await this.fs.promises.readFile(`${config.SRC}/${filename}`, "utf8")
    let { content, data } = matter(md)
    data.permalink = filename
    let html = marked(content, { baseUrl: "../" }) 

    await this.processContent(
      { content, html, data, filename }, 
      config
    )
    await this.processImages({ content }, config)

    return { html, data }
  }
  async getPost (key) {
    let md = await this.fs.promises.readFile(`${this.config.SRC}/${key}`, "utf8")
    return matter(md)
  }
  async build () {
    let src = await this.fs.promises.readdir(this.config.SRC)
    let items = await Promise.all(src.filter((key) => { return key !== "assets" }).map((key) => {
      return new Promise(async (resolve, reject) => {
        let { content, data } = await this.getPost(key) 
        resolve({
          key: key,
          data: data,
          content: content
        })
      })
    }))
    let publicItems = []
    for(let item of items) {
      if (item.data.draft) {
        await this.fs.promises.unlink(`${this.config.DEST}/${key}/index.html`)
      } else {
        publicItems.push(item)
      }
    }
    publicItems.sort((a, b) => {
      return parseInt(b.data.updated) - parseInt(a.data.updated);
    })

    let modules = await Promise.all(this.config.events.publish.map((mod) => {
      return import(`../module/${mod}`)
    }))
    for(let mod of modules) {
      await mod.default(publicItems, this.config, {
        fs: this.fs, git: this.git
      })
    }
  }
}
