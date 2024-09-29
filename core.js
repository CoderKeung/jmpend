const Axios = require("axios");
const Cheerio = require("cheerio");
const Docx = require("docx");
const Fs = require("fs");
const Database = require("./database");

class Util {

  constructor() { }

  // 查找在两个字符之间的子字符串
  extractTextAndReturnRemainder(target, start, end) {
    // 从目标字符串中提取两个指定字符之间的内容
    let result = target.substring(
      target.search(start) + start.length,
      target.search(end)
    );
    // 移除最后一个分号及其后面的内容
    result = result.substring(0, result.lastIndexOf(";"));
    return result;
  }

  // 判断字符串是否包含HTML标签
  isHtml(string) {
    const reg = /<[^>]+>/g;
    return reg.test(string);
  }

  // 从HTML字符串中提取纯文本
  extractTextInHtml(string) {
    if (this.isHtml(string)) {
      // 如果是HTML，移除所有标签
      return string.replace(/<[^>]+>/g, "");
    } else {
      // 如果不是HTML，直接返回原字符串
      return string;
    }
  }

  // 下载图片并转换为ArrayBuffer
  async downloadImage(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return blob.arrayBuffer();
  }

  // 从URL获取HTML内容
  
  async extractHtmlFromUrl(url, params={}) {
    try {
      const result = await Axios.get(url, { params })
      return result.data;
    } catch (error) {
      console.log(error);
    }
  }

  // 检查URL是否属于特定域名
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

class Book {

  SESSION_ID = "";
  SESSION_URL= "http://opac.nlc.cn/F";
  ISBN = "";
  PARAMS = {
    func: 'find-b',
    find_code: 'ISB',
    request: this.ISBN,
    local_base: 'NLC01',
    filter_code_1: 'WLN',
    filter_request_1: '',
    filter_code_2: 'WYR',
    filter_request_2: '',
    filter_code_3: 'WYR',
    filter_request_3: '',
    filter_code_4: 'WFM',
    filter_request_4: '',
    filter_code_5: 'WSL',
    filter_request_5: ''
  }
  UTIL = new Util();
  BOOKINFO = {};

  constructor(isbn) {
    this.ISBN = isbn;
    this.PARAMS.request = this.ISBN;
  }

  async start() {
    await this.setSessionId();
    await this.getBookInfo();
    Database.addBookList(this.BOOKINFO);
  }

  async setSessionId() {
    const htmlstring =  await this.UTIL.extractHtmlFromUrl(this.SESSION_URL);
    const $ = Cheerio.load(htmlstring);
    // 查找包含登录链接的 a 标签
    const loginLink = $('a.blue3[title="输入用户名和密码"]');
  
    if (loginLink.length > 0) {
      const href = loginLink.attr('href');
      // 从 href 中提取会话 ID
      const match = href.match(/F\/([^?]+)/);
      if (match && match[1]) {
        this.SESSION_ID = match[1];
      } else {
       throw new Error('未找到会话 ID');
      }
    } else {
      throw new Error('未找到登录链接');
    }
  }

  setISBN(isbn) {
    const line = isbn.split(" ");
    this.BOOKINFO.isbn = line[0];
  }

  setTitle(title) {
    title = title.replace(/\s+[a-z\s]+(?=\s|$)/gi, '');
    this.BOOKINFO.title = title;
  }

  setAuthor(author) {
    author = author.replace(/\s+[a-zA-Z\s]+/g, '');
    this.BOOKINFO.author = author;
  }

  setPublisher(publisher) {
    this.BOOKINFO.publisher = publisher;
  }

  setPrice(price) {
    const line = price.split(" ");
    this.BOOKINFO.price = line[line.length - 1];
  }

  setCall(call) {
    this.BOOKINFO.call = call;
  }

  setTag(tag) {
    this.BOOKINFO.tag = tag;
  }

  async getBookInfo() {
    const baseUrl = `${this.SESSION_URL}/${this.SESSION_ID}`; 
    const htmlString = await this.UTIL.extractHtmlFromUrl(baseUrl, this.PARAMS);
    const $ = Cheerio.load(htmlString);
    const publishSection = $('*').contents().filter(function() {
      return this.type === 'comment' && this.data.includes('publish section');
    });
    const commentContent = publishSection[0].data;
    const lines = commentContent.split('\n').filter(line => line.trim() !== '');
    let temp = {};
    lines.forEach(line => {
      line = line.trim();
      if (line && line !== 'publish section') {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          if (key && value) {
            temp[key] = value;
          }
        }
      }
    });
    this.setBookInfo(temp);
  }

  setBookInfo(temp) {
    this.setISBN(temp.ISBN);
    this.setTitle(temp.TITLE);
    this.setAuthor(temp.AUTHOR);
    this.setPublisher(temp.IMPRINT);
    this.setPrice(temp.ISBN);
    this.setCall(temp['CALL-NO']);
    this.setTag(temp['CALL-NO']);
  }
}
module.exports = {
  Conversion,
  Book
}