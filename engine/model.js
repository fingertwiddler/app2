import uslug from "https://jspm.dev/uslug"
import matter from "https://jspm.dev/gray-matter"
export class Model {
  constructor(o) {
    this.fs = o.fs
    this.git = o.git
    this.builder = o.builder
    this.config = o.config
    this.src = o.src
  }
  async updated () {
    const FILE = 0, HEAD = 1, WORKDIR = 2, STAGE = 3
    let matrix = await this.git.statusMatrix({ this.fs, dir: "/home" })
    const filenames = matrix.filter((row) => { return !(row[HEAD] === 1 && row[WORKDIR] === 1 && row[STAGE] === 1) }).map(row => row[FILE])
    return filenames.length > 0
  }
  async deleted () {
    const FILE = 0, HEAD = 1, WORKDIR = 2, STAGE = 3
    let matrix = await this.git.statusMatrix({ this.fs, dir: "/home" })
    return matrix.filter((row) => { return row[WORKDIR] === 0 })
  }
  async build () {
    await this.builder.build()
  }
  async buildPost(filename) {
    await this.builder.buildPost(filename, this.config)
  }
  async load(path) {
    let raw = await this.fs.promises.readFile(path, "utf8")
    let { data, content } = matter(str)
    return { data, content, raw }
  }
  async unpublish({ content, data }) {
    data.draft = true
    let updatedContent = matter.stringify(content, data)
    await this.fs.promises.writeFile(this.src, updatedContent)
    await this.builder.build()
  }
  async publish({ content, data }) {
    data.draft = false;
    let updatedContent = matter.stringify(content, data)
    await this.fs.promises.writeFile(this.src, updatedContent)
    let isupdated = await this.updated()
    if (!isupdated) {
      console.log("no update")
      alert("no update")
      return;
    }
    await this.builder.build()
  }
  async save( { content, data, raw }) {
    let matches = raw.matchAll(/!\[.*?\]\((.*?)\)/g)
    let images = []
    for (let match of matches) {
      images.push(match[1])
    }
    let imageTags = images.map((image, i) => {
      return (i === 0 ?  `<img class='selected' src='${image}'>` : `<img src='${image}'>`)
    }).join("")
    let desc = (data.description ? data.description : document.querySelector(".tui-editor-contents").textContent.trim().replace(/(\r\n|\n|\r)/gm,"").slice(0, 300))
    let {title, description, image} = await Swal.fire({
      title: 'Save',
      html: `<form class='publish-form'>
  <input class='title' type='text' placeholder='enter title' value='${data.title ? data.title : ""}'>
  <textarea class='description'>${desc}</textarea>
  <div class='images'>${imageTags}</div>
  </form>`,
      confirmButtonText: 'Save',
      didOpen: (el) => {
        el.querySelector(".images").addEventListener("click", (e) => {
          document.querySelectorAll(".images img").forEach((el2) => {
            el2.classList.remove("selected")
          })
          if (e.target.getAttribute("src")) e.target.classList.toggle("selected")
        })
      },
      preConfirm: async () => {
        let image = document.querySelector(".publish-form .images img.selected")
        let title = document.querySelector(".publish-form .title").value
        if (!title || title.length === 0) {
          alert("please enter title")
          return false;
        }
        try {
          // the first time creating a file,
          if (!this.src) {
            //does the title already exist?
            let slug = title.split().join("-").toLowerCase()
            let f = await this.fs.promises.stat(`${this.config.SRC}/${slug}`)
            // if already exists, return false
            alert("the file already exists")
            return false;
          }
        } catch (e) {
        }
        return [
          document.querySelector(".publish-form .title").value,
          document.querySelector(".publish-form .description").value,
          (image ? image.getAttribute("src") : null)
        ]
      }
    }).then((res) => {
      return {
        title: res.value[0],
        description: res.value[1],
        image: res.value[2]
      }
    })
    data.title = title
    data.description = description
    data.image = image
    data.updated = Date.now()

    let name
    let status = "updated"
    if (this.src) {
      name = this.src.split("/")[3]
    } else {
      name = uslug(title)
      this.src = `${this.config.SRC}/${name}`
      status = "created"
    }
    data.permalink = name;

    let updatedContent = matter.stringify(content, data)
    await this.fs.promises.writeFile(`${this.config.SRC}/${data.permalink}`, updatedContent)
    await this.builder.buildPost(data.permalink, this.config)
    return status
  }
  async destroy() {
    // Delete files
    await this.fs.promises.unlink(this.src)
    let name = this.src.split("/")[2]
    await this.fs.promises.unlink(`${this.config.SRC}/${name}/index.html`).catch((e) => { })
    await this.fs.promises.rmdir(`${this.config.SRC}/${name}`).catch((e) => {})
    // remove from git too.
    let d = await this.deleted()
    for(let item of d) {
      await git.remove({ this.fs, dir: "/home", filepath: item[0] })
    }
    // Build
    await this.builder.build()
  }
  async saveImage(blob, callback) {
    let ab = await blob.arrayBuffer()
    let bytes = new Uint8Array(ab)
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    await this.fs.promises.writeFile(`${this.config.SRC}/assets/${hash}`, bytes).catch((e) => { console.log("error", e) })
    callback("assets/" + hash, hash)
  }
}
