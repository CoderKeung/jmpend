const NeDB = require('nedb')

const db = new NeDB({
    filename: "./database.db",
    autoload: true
})

function articleIdExists(articleId) {
    return new Promise((resolve, reject)=>{
        db.findOne({_id: articleId}, function (err, doc) {
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
            db.insert({
                _id: articleJson.id,
                title: articleJson.title,
                author: articleJson.author
            }, function (err, article) {
                console.log(article);
            })
        }
    })
}

module.exports = {
    articleIdExists: articleIdExists,
    addArticleList : addArticleList
}