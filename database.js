const NeDB = require('nedb')

const databases = {
    articles: new NeDB({ filename: "./database/articles.db", autoload: true }),
    books: new NeDB({ filename: "./database/books.db", autoload: true }),
}

function articleIdExists(articleId) {
    return new Promise((resolve, reject)=>{
        databases.articles.findOne({_id: articleId}, function (err, doc) {
            if (err) {
                reject(err);
                return;
            }
            if (doc) {
                resolve({
                    status: true,
                    article: doc
                });
            } else {
                resolve({
                    status: false,
                    article: null
                });
            }
        })
    })
}

function addArticleList(articleJson){
    articleIdExists(articleJson.id).then((exists) => {
        if(exists.status) {
            console.log("文章已经存在!");
        } else {
            databases.articles.insert({
                _id: articleJson.id,
                title: articleJson.title,
                author: articleJson.author
            }, function (err, article) {
                console.log(article);
            })
        }
    })
}

function bookIsbnExists(isbn) {
    return new Promise((resolve, reject) => {
        databases.books.findOne({_id: isbn}, function (err, doc) {
            if (err) {
                reject(err);
                return;
            }
            if (doc) {
                resolve({
                    status: true,
                    book: doc
                });
            } else {
                resolve({
                    status: false,
                    book: null
                });
            }
        })
    })
}

function addBookList(bookJson) {
    bookIsbnExists(bookJson.isbn).then((exists) => {
        if(exists.status) {
            console.log("书籍已经存在!");
        } else {
            databases.books.insert({
                _id: bookJson.isbn,
                title: bookJson.title,
                author: bookJson.author,
                publisher: bookJson.publisher,
                price: bookJson.price,
                call: bookJson.call,
                tag: bookJson.tag
            }, function (err, book) {
                console.log(book);
            })
        }
    })
}

function getBookByIsbn(isbn) {
    return new Promise((resolve, reject) => {
        databases.books.findOne({_id: isbn}, function (err, doc) {
            if (err) {
                reject(err);
                return;
            } if (doc) {
                resolve({
                    status: true,
                    book: doc
                });
            } else {
                resolve({
                    status: false,
                    book: null
                });
            }
        })
    })
}

function getAllBooks() {
    return new Promise((resolve, reject) => {
        databases.books.find({}, function (err, docs) {
            if (err) {
                reject(err);
            }
            resolve(docs);
        })
    })
}

module.exports = {
    articleIdExists,
    addArticleList,
    bookIsbnExists,
    addBookList,
    getBookByIsbn,
    getAllBooks
}