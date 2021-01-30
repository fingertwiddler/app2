import matter from "https://jspm.dev/gray-matter"
import Editor from "https://jspm.dev/@toast-ui/editor"
export class E {
  constructor (o) {
    this.config = o.config
    this.model = o.model
    this.editor = new Editor({
      frontMatter: true,
      el: document.querySelector('#editor'),
      height: '100%',
      initialEditType: 'markdown',
      usageStatistics: false,
      previewStyle: 'vertical',
      events: {
        change: () => {
          document.querySelector("#save").classList.add("enabled")
        }
      },
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          await this.model.saveImage(blob, callback)
          return false;
        }
      }
    });
  }
  async fill (path) {
    this.src = decodeURIComponent(path)
    let { content, data, raw }  = await this.model.load(this.src)
    this.editor.setMarkdown(raw)
    if (data.draft) {
      document.querySelector("#unpublish").classList.add("hidden")
      document.querySelector(".draft").classList.remove("hidden")
    }
  }
  content() {
    let raw = this.editor.getMarkdown()
    let { content, data } = matter(raw)
    return { content, data, raw }
  }
  async unpublish() {
    await this.model.unpublish(this.content())
    location.href = "/upload"
  }
  async publish() {
    await this.model.publish(this.content())
    location.href = "/upload"
  }
  async save() {
    //let { content, data, raw } = this.content()
    let { status, name } = await this.model.save(this.content())
    if (status === "created") {
      location.href = "./editor?src=" + name;
    } else {
      document.querySelector("#save").classList.remove("enabled")
      this.editor.setMarkdown(updatedContent)
    }
  }
  async destroy() {
    if (!this.src) return;
    let sure = confirm("are you sure?")
    if (sure) {
      await this.model.destroy()
      location.href = "/upload"
    }
  }
};
