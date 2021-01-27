import Handlebars from "https://jspm.dev/handlebars"
import matter from "https://jspm.dev/gray-matter"
import marked from "https://jspm.dev/marked"
import RSS from "https://jspm.dev/rss"
const paginator = (M, filenames, meta, template, CHUNK) => {
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
      title: M.config.settings.name,
      base: M.config.settings.base,
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
const buildPost = async (M, fs, key) => {
  let tps = await fs.promises.readFile("/theme/post.hbs", "utf8")
  let tpl = Handlebars.compile(tps)
  // Parse the source file
  let contentPath = M.config.path.src.content + "/" + key
  let content = await fs.promises.readFile(contentPath, "utf8")
  let parsed = matter(content)
  let md = parsed.content
  let metadata = parsed.data
  metadata.permalink = key

  // Build Rendered Markdown HTML
  //let html = marked(md)
  let html = marked(md, { baseUrl: M.config.settings.base }) 
  console.log("html = ", html)
  debugger;

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
      let assetPath = M.config.path.src.assets + "/" + match[1]
      let b = await fs.promises.readFile(assetPath)
      await fs.promises.writeFile(M.config.path.dest.assets + "/" + match[1], b)
    }
  }

  console.log("metadata = ", metadata)
  debugger;
  // Build full HTML page
  let rendered = tpl({
    base: M.config.settings.base,
    name: M.config.settings.name,
    menu: M.config.settings.menu,
    content: html,
    updated: metadata.updated,
    filename: M.config.path.src + "/" + key,
    title: metadata.title
  }).trim()
  console.log("rendered html = ", rendered)

  // Write to the post folder
  await fs.promises.mkdir(M.config.path.dest.content).catch((e) => { })
  await fs.promises.mkdir(M.config.path.dest.content + "/" + key).catch((e) => {
    console.log("exists")
  })
  await fs.promises.writeFile(M.config.path.dest.content + "/" + key + "/index.html", rendered)

  return { html, metadata }
}
export const build = async (M, fs, src) => {
  // Create folders in case they're empty
  await fs.promises.mkdir(M.config.path.dest.content).catch((e) => {})
  await fs.promises.mkdir(M.config.path.dest.content + "/pages").catch((e) => {})
  await fs.promises.mkdir(M.config.path.dest.assets).catch((e) => {})
  let { html, metadata } = await buildPost(M, fs, src) 

}
export const builder = async (M, fs) => {
  // Create folders in case they're empty
  await fs.promises.mkdir(M.config.path.dest.content).catch((e) => {})
  await fs.promises.mkdir(M.config.path.dest.content + "/pages").catch((e) => {})
  await fs.promises.mkdir(M.config.path.dest.assets).catch((e) => {})

  // Instantiate templates
//  let tis = await fs.promises.readFile("/app/index.hbs", "utf8")
  let tds = await fs.promises.readFile("/theme/dashboard.hbs", "utf8")
  let tps = await fs.promises.readFile("/theme/post.hbs", "utf8")
  let tpl = {
    post: Handlebars.compile(tps),
    dashboard: Handlebars.compile(tds)
  }

  // Instantiate RSS
  let feed = new RSS()

  let filenames = []
  let meta = {}
  let src = await fs.promises.readdir(M.config.path.src.content)
  for(let key of src) {
    if (key === ".git") continue;
    if (key === "assets") {
      // Copy all assets to build folder
      try {
        let docassets = await fs.promises.stat(M.config.path.dest.assets)
      } catch (e) {
        await fs.promises.mkdir(M.config.path.dest.assets)
      }
      let assets = await fs.promises.readdir(M.config.path.src.assets)
      for(let file of assets) { 
        let b = await fs.promises.readFile(M.config.path.src.assets + "/" + file)
        await fs.promises.writeFile(M.config.path.dest.assets + "/" + file, b)
      }
    } else {

      let { html, metadata } = await buildPost(M, fs, key) 
      meta[key] = metadata

      if (metadata.draft) {
        await fs.promises.unlink(M.config.path.dest.content + "/" + key + "/index.html")
      } else {
        filenames.push(key)
      }

      // Add to RSS feed
      feed.item({
        title: metadata.title,
        description: html,
        url: M.config.settings.host + M.config.path.dest.content + "/" + key,
        date: metadata.updated
      })

    }
  }

  let xml = feed.xml({ indent: true });
  await fs.promises.writeFile(M.config.path.dest.content + "/rss.xml", xml)

  // build index.html
  filenames.sort((a, b) => {
    return parseInt(meta[b].updated) - parseInt(meta[a].updated);
  })

  try {
    let docassets = await fs.promises.stat(M.config.path.dest.content + "/pages")
  } catch (e) {
    await fs.promises.mkdir(M.config.path.dest.content + "/pages")
  }

  let pages = await paginator(M, filenames, meta, tpl.dashboard, 3)
  for(let i=0; i<pages.length; i++) {
    await fs.promises.mkdir(M.config.path.dest.content + "/pages/" + i).catch((e) => {
      console.log("exists")
    })
    await fs.promises.writeFile(M.config.path.dest.content + "/pages/" + i + "/index.html", pages[i])
    if (i === 0) {
      await fs.promises.writeFile(M.config.path.dest.content + "/index.html", pages[i])
    }
  }
}
