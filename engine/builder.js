import Handlebars from "https://jspm.dev/handlebars"
import matter from "https://jspm.dev/gray-matter"
import marked from "https://jspm.dev/marked"
import RSS from "https://jspm.dev/rss"
export class Builder {
  constructor(config) {
    this.config = config
  }
  paginator (filenames, meta, template, CHUNK) {
    let pages = [];
    let counter = []
    for (let i=0; i<filenames.length; i+=CHUNK) {
      let page = filenames.slice(i, i + CHUNK)
      pages.push(page)
      counter.push({ number: i/CHUNK })
    }
    console.log("pages = ", pages)
    let res = []
    for(let i=0; i<pages.length; i++) {
      counter[i].current = true;
      let html = template({
        title: this.config.NAME,
        base: this.config.BASE,
        items: pages[i].map((filename) => {
          return {
            filename: filename,
            meta: meta[filename]
          }
        }),
        pages: counter
      })
      res.push(html)
      counter[i].current = false;
    }
    return res
  }
  async buildPost (fs, key) {
    let tps = await fs.promises.readFile("/theme/post.hbs", "utf8")
    let tpl = Handlebars.compile(tps)
    // Parse the source file
    let contentPath = `${this.config.SRC}/${key}`
    let content = await fs.promises.readFile(contentPath, "utf8")
    let parsed = matter(content)
    let md = parsed.content
    let metadata = parsed.data
    metadata.permalink = key

    // Build Rendered Markdown HTML
    //let html = marked(md)
    let html = marked(md, { baseUrl: this.config.BASE }) 

    // createa hidden dom
    let div = document.createElement("div")
    div.innerHTML = html
    let images = []
    div.querySelectorAll("img").forEach((el) => {
      images.push(el.getAttribute("src"))
    })

    // copy all assets
    for(let image of images) {
      let match = /assets\/(.+)$/.exec(image)
      if (match && match.length > 0) {
        let assetPath = `${this.config.SRC}/assets/${match[1]}`
        let b = await fs.promises.readFile(assetPath)
        await fs.promises.writeFile(`${this.config.SRC}/assets/${match[1]}`, b)
      }
    }
    // Build full HTML page
    let rendered = tpl({
      base: this.config.BASE,
      name: this.config.NAME,
      content: html,
      updated: metadata.updated,
      filename: `${this.config.SRC}/${key}`,
      title: metadata.title
    }).trim()

    // Write to the post folder
    await fs.promises.mkdir(this.config.SRC).catch((e) => { })
    await fs.promises.mkdir(`${this.config.SRC}/${key}`).catch((e) => { })
    await fs.promises.writeFile(`${this.config.SRC}/${key}/index.html`, rendered)

    return { html, metadata }
  }
  async build (fs) {
    // Create folders in case they're empty
    await fs.promises.mkdir(this.config.DEST).catch((e) => {})
    await fs.promises.mkdir(`${this.config.DEST}/pages`).catch((e) => {})
    await fs.promises.mkdir(`${this.config.DEST}/assets`).catch((e) => {})

    // Instantiate templates
  //  let tis = await fs.promises.readFile("/app/index.hbs", "utf8")
    let tds = await fs.promises.readFile(this.config.THEME.HOME, "utf8")
    let tps = await fs.promises.readFile(this.config.THEME.POST, "utf8")
    let tpl = {
      post: Handlebars.compile(tps),
      dashboard: Handlebars.compile(tds)
    }

    // Instantiate RSS
    let feed = new RSS()

    let filenames = []
    let meta = {}
    let src = await fs.promises.readdir(this.config.SRC)
    for(let key of src) {
      if (key === ".git") continue;
      if (key === "assets") {
        // Copy all assets to build folder
        await fs.promises.mkdir(`${this.config.SRC}/assets`).catch((e) => { })
        let assets = await fs.promises.readdir(`${this.config.SRC}/assets`)
        for(let file of assets) { 
          let b = await fs.promises.readFile(`${this.config.SRC}/assets/${file}`)
          await fs.promises.writeFile(`${this.config.DEST}/assets/${file}`, b)
        }
      } else {
        let { html, metadata } = await this.buildPost(M, fs, key) 
        meta[key] = metadata
        if (metadata.draft) {
          await fs.promises.unlink(`${this.config.DEST}/${key}/index.html`)
        } else {
          filenames.push(key)
        }
        feed.item({
          title: metadata.title,
          description: html,
          url: `${this.config.BASE}/${key}`,
          date: metadata.updated
        })
      }
    }
    let xml = feed.xml({ indent: true });
    await fs.promises.writeFile(`${this.config.DEST}/rss.xml`, xml)
    filenames.sort((a, b) => {
      return parseInt(meta[b].updated) - parseInt(meta[a].updated);
    })
    await fs.promises.mkdir(`${this.config.DEST}/pages`).catch((e) => { })
    let pages = await this.paginator(M, filenames, meta, tpl.dashboard, 3)
    for(let i=0; i<pages.length; i++) {
      await fs.promises.mkdir(`${this.config.DEST}/pages/${i}`).catch((e) => { })
      await fs.promises.writeFile(`${this.config.DEST}/pages/${i}/index.html`, pages[i]).catch((e) => { })
      if (i === 0) await fs.promises.writeFile(`${this.config.DEST}/index.html`, pages[i])
    }
  }
}
