const Axios = require("axios");
const Cheerio = require("cheerio");
const Docx = require("docx");
const Fs = require("fs");
const Database = require("./database");

class Util {

  constructor() { }

  // 查找在两个字符之间的子字符串
  extractTextAndReturnRemainder(target, start, end) {
    let result = target.substring(
      target.search(start) + start.length,
      target.search(end)
    );
    result = result.substring(0, result.lastIndexOf(";"));
    return result;
  }

  isHtml(string) {
    const reg = /<[^>]+>/g;
    return reg.test(string);
  }

  extractTextInHtml(string) {
    if (this.isHtml(string)) {
      return string.replace(/<[^>]+>/g, "");
    } else {
      return string;
    }
  }

  async downloadImage(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return blob.arrayBuffer();
  }

  async extractHtmlFromUrl(url) {
    try {
      const result = await Axios.get(url)
      return result.data;
    } catch (error) {
      console.log(error);
    }
  }

  isSpecificDomain(url, domain) {
    const urlArray = url.split('/')
    return urlArray[2] === domain;
  }

}

class Conversion {

  URL = "";
  UTIL = new Util();
  STYLEPATH = __dirname + "/static/styles.xml";
  DOCXPATH = __dirname + "/docx";
  DOCXFILEPATH = ""
  SUCCESS = false;

  ARTICLESTRING = "";
  ARTICLEJSON = {};

  ARTICLE = {
    id: 0,
    title: {},
    author: {},
    content: {},
  };

  PARAGRAPHS = [];

  constructor(url) {
    this.URL = url;
  }

  async start() {
    try {
      this.SUCCESS = false;
      await this.UTIL.extractHtmlFromUrl(this.URL).then(
        async (htmlString) => {
          this.ARTICLESTRING = htmlString;
          this.createDocxPath();
          await this.initializationArticleData().then(()=>{
            this.createDocument().then(()=>{
              this.DOCXFILEPATH = `${this.DOCXPATH}/${this.ARTICLE.id}.docx`;
              Database.addArticleList(this.ARTICLE);
              this.SUCCESS = true;
              this.printDocxLog();
            })
          });
        }
      )
    } catch (error) {
      console.log(error)
    }
  }

  // 创建文档存储文件夹
  createDocxPath() {
    if (!Fs.existsSync(this.DOCXPATH)) {
      Fs.mkdirSync(this.DOCXPATH, { recursive: true })
    }
  }

  printArticleLog() {
    console.log(`文章名称：${this.ARTICLE.title}`)
    console.log(`文章作者：${this.ARTICLE.author}`)
  }
  printDocxLog() {
    console.log(`文档名: ${this.DOCXFILEPATH}`)
    console.log("转换完成！");
  }

  // 初始化文章数据
  async initializationArticleData() {
    this.extractDataJsonFromHtml();
    this.initializationArticleConstant();
    this.printArticleLog();
    await this.initializationParagraphsConstant()
  };

  // 判断是否是简篇的文章
  isJianPian() {
    if (this.UTIL.isSpecificDomain(this.URL, "www.jianpian.cn") || this.UTIL.isSpecificDomain(this.URL, "www.wztg0.cn")) {
      return true;
    };
  }

  // 从 HTML 中提取文章的 JSON 格式信息
  extractDataJsonFromHtml() {
      const $ = Cheerio.load(this.ARTICLESTRING);
      let scriptText = $("script").text();
      let dataSting = "";
      if (this.isJianPian()) {
        dataSting = this.UTIL.extractTextAndReturnRemainder(
          scriptText,
          "window.__INITIAL_STATE__ =",
          "function",
        )
      } else {
        dataSting = this.UTIL.extractTextAndReturnRemainder(
          scriptText,
          "var ARTICLE_DETAIL = ",
          "var detail = ",
        )
      }
      this.ARTICLEJSON = JSON.parse(dataSting);
  }

  // 设置 ARTICLE 常量的值
  setArticleConstant(id, title, author, content) {
    this.ARTICLE.id = id;
    this.ARTICLE.title = title;
    this.ARTICLE.author = author;
    this.ARTICLE.content = content;
  }

  // 初始化 ARTICLE 常量
  initializationArticleConstant() {
    if (this.isJianPian()) {
      this.setArticleConstant(
        this.ARTICLEJSON.detail.article.mask_id,
        this.ARTICLEJSON.detail.article.title,
        this.ARTICLEJSON.users.author.nickname,
        this.ARTICLEJSON.detail.article.content,
      )

    } else {
      this.setArticleConstant(
        this.ARTICLEJSON.article.mask_id,
        this.ARTICLEJSON.article.title,
        this.ARTICLEJSON.author.nickname,
        this.ARTICLEJSON.content
      )
    }
  }

  // 初始化 PARAGRAPHS 常量
  async initializationParagraphsConstant() {
    // 创建标题
    this.PARAGRAPHS.push(new Docx.Paragraph({
      children: [new Docx.TextRun(this.ARTICLE.title)],
      style: "GWH"
    }));
    // 创建作者
    this.PARAGRAPHS.push(new Docx.Paragraph({
      children: [new Docx.TextRun(this.ARTICLE.author)],
      style: "GWT"
    }));
    // 创建内容以及图片
    for (let content of this.ARTICLE.content) {
      if (content.text) {
        this.PARAGRAPHS.push(
          new Docx.Paragraph({
            children: [new Docx.TextRun(this.UTIL.extractTextInHtml(content.text))],
            style: "GWP",
          })
        );
      } else if (content.img_url) {
        await this.UTIL.downloadImage(content.img_url).then((buffer) => {
          this.progress = this.progress - 1;
          this.PARAGRAPHS.push(
            new Docx.Paragraph({
              children: [new Docx.ImageRun({
                data: buffer,
                transformation: {
                  width: 600,
                  height: 300,
                },
              })]
            })
          );
        })
      }
    }
  }

  // 创建文档
  async createDocument() {
    const docx = new Docx.Document({
      externalStyles: Fs.readFileSync(this.STYLEPATH, "utf-8"),
      sections: [{
        properties: {
          page: {
            margin: {
              top: "3cm",
              bottom: "2.5cm",
              right: "2.5cm",
              left: "2.5cm",
            },
          },
        },
        children: this.PARAGRAPHS,
      }],
    });
    Docx.Packer.toBuffer(docx).then((buffer) => {
      Fs.writeFileSync(this.DOCXFILEPATH, buffer);
    })
  }

}

module.exports = {
  Conversion: Conversion
}