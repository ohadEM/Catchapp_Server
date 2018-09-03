const express = require('express');
const bodyParser = require('body-parser');
const cogserv = require('cogserv-text-analytics')({key: "be5cce28a9694bf192daeb242d114e08"})
const {keyPhrases, sentiment} = require('cogserv-text-analytics')

const TextRazor = require('textrazor')
const textRazorAPIKeys = ["1f5b8b282f0efbf7da5f6c543a16a45d58d3ec090ba069c92ffc9587",
    "60d32def4796a0ba0bc0d0f82d0414f9dcf71f9b681c8d7b2fbee5a9",
    "74d2d06182a2d6d1d59d4d4b2d3f2e76f2b63c01c95bb819f66d9646",
    "5db053efa742e75a2968fdc61e62aa11b3731d4ff0ebe187f92f9561",
    "5a0725ca1804b4c87b3bb37f4569bd6c02d3db7d839d59158e8735aa",
    "225b34b0648788914ae9c8739cc692efdb173b7c46b1c54cb4d65d3c",
    "a101e468ae4fe27c741b94bb9a9e6eb1ee893ec2da7a349fab4a7421",
    "2b68b24659a55cad0baf57196b6b904daa56bb12af71210c806859d5",
    "22da8bf65883b4ed8d0b592e81530965b68bc9b68814f47d48cb7b63",
    "2e014267331c5ac334dddc995eeacc2e7cb02c3889651caad86c016d"]

const wiki = require('wikijs').default; //Wikipedia API

var app = express();
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
var object = {}
var port = process.env.PORT || 8010;
app.listen(port);

app.get("", function(req, res){
    res.setHeader('Content-Type', 'application/json');
    res.send({"welcome": "!"});
});

app.get("/phrases", function(req, res){
    var textRazor = new TextRazor(textRazorAPIKeys[Math.round(Math.random() * textRazorAPIKeys.length)])
    res.setHeader('Content-Type', 'application/json');
    let textRazorOptions = {extractors: 'entities'}
    let text = req.headers.text.toUpperCase();
    userLang = req.headers.lang.toLowerCase();
    textRazor.exec(text, textRazorOptions).then(terms =>{
        let phrases = terms.response.entities;
        if(phrases != undefined){
            phrasesLoop(phrases, userLang).then(obj =>{
                res.send(obj);
            }).catch(err => console.error(err));
        } else{
            res.send({"Error": "Can't find entities in: " + req.headers.text});
        }
    }).catch(err => console.error(err));
});

async function phrasesLoop(phrases, userLang){
    var ret = await new Promise(resolve =>{
        let lang = userLang;
        let finalPhrases = [];
        for(var i = 0; i < phrases.length; i++){
            if(!finalPhrases.includes(phrases[i].entityId)){
                finalPhrases.push(phrases[i].entityId);
            }
        }
        let obj = {};
        var counter = 0;
        for(var j = 0; j < finalPhrases.length; j++){
            wikiTerm(finalPhrases[j], lang).then(wiki =>{
                if(wiki != undefined && Object.keys(wiki).length != 0){
                    if(wiki.englishTitle != undefined){
                        obj[wiki.englishTitle] = wiki;
                    } else{
                        obj.Error = wiki;
                    }
                    counter++;
                    if(counter == finalPhrases.length){
                        resolve(obj);
                    }
                } else{
                    counter++;
                    if(counter == finalPhrases.length){
                        resolve(obj);
                    }
                }
            }).catch(err =>{
                counter++;
                console.error(err);
            });
        }
    });
    return ret;
}

async function wikiTerm(term, userLang){
    let term1 = term;
    var retWikiTerm = await new Promise(resolve =>{
            let langCountry;
            let obj = {};
            let counter = 0;
            wiki().search(term1, 1).then(data =>{
                wiki().page(data.results[0]).then(page =>{
                    findLang(page, userLang).then(arr =>{ //country,langTitle,englishTitle
                        if(arr != undefined && arr.length == 3){
                            objBuild(arr[0], arr[1], arr[2]).then(obj =>{
                                resolve(obj);
                            }).catch(err =>{
                                console.error(err);
                                resolve({});
                            });
                        }
                    }).catch(err =>{
                        console.error(err);
                        resolve({"Error": "Can't find Wikipedia page of: " + term1 + " in your specified language"});
                    });
                }).catch(err =>{
                    console.error(err);
                    resolve({"Error": "Can't find Wikipedia page of: " + term1 + " in your specified language"});
                });
            }).catch(err =>{
                console.error(err);
                resolve({"Error": "Can't find Wikipedia search values of: " + term1});
            });
        }
        )
    ;
    return retWikiTerm;
}

async function objBuild(langCountry, langTitle, englishTitle){
    var retObj = await new Promise(resolve =>{
        var obj = {};
        obj.englishTitle = englishTitle;
        obj.title = langTitle;
        wiki({apiUrl: 'http://' + langCountry + '.wikipedia.org/w/api.php'}).page(langTitle).then(page =>{
            obj.url = page.raw.fullurl;
            page.summary().then(summary =>{
                // if(summary.length < 110 || summary == undefined){
                obj.summary = "";
                // } else{
                summary = summary.split(/[.;]/);
                var sumSummary = "";
                for(var i = 0; i < summary.length; i++){
                    if(sumSummary.length < 350){
                        sumSummary += summary[i] + ".";
                    }
                }
                sumSummary = sumSummary.replace(/\.\./gm, '.');
                sumSummary = sumSummary.replace(/(\[\d*\])/gm, '');
                if(sumSummary.indexOf("may refer to:") != -1){
                    page.links().then(links =>{
                        if(links.length > 0){
                            let link = links[0];
                            let linkArr = [];
                            for(var i in links){
                                if(links[i].toLowerCase().startsWith(langTitle.toLowerCase())){
                                    linkArr.push(links[i]);
                                }
                            }
                            if(linkArr.length > 1){
                                var minLength = 10000;
                                var minJ;
                                for(var j in linkArr){
                                    if(linkArr[j].length < minLength){
                                        minLength = linkArr[j].length;
                                        minJ = j;
                                    }
                                }
                                link = linkArr[minJ];

                            } else if(linkArr.length == 1){
                                link = linkArr[0];
                            }
                            wikiTerm(link, userLang).then(obj1 =>{
                                resolve(obj1);
                            });
                        } else{
                            resolve({"Error": "No links for term"});
                        }

                    });
                } else{
                    obj.summary = sumSummary;
                    if(obj.summary != ""){
                        obj.image = "";
                        page.images().then(images =>{
                            if(images != undefined){
                                for(var i = 0; i < images.length; i++){
                                    if(images[i].endsWith(".jpg") || images[i].endsWith(".png")){
                                        obj.image = images[i];
                                        break;
                                    }
                                }
                            }
                            resolve(obj);
                        }).catch(err =>{
                            resolve(obj);
                        });
                    } else{
                        resolve({"Error": "Summery of " + englishTitle + " is to short and probably not found right"});
                    }
                }
            })
        })
    });
    return retObj;
}

async function findLang(page, userLang){
    var langArr = await new Promise(resolve =>{
        var arr = [];
        page.langlinks().then(langsArray =>{
            if(langsArray == undefined || langsArray.length < 3){    //does not return object with less then 5 translations
                resolve(arr);
            }
            arr[2] = page.raw.title; //englishTitle
            langTitle = page.raw.title;
            langCountry = "en";
            for(var i = 0; i < langsArray.length; i++){
                if(langsArray[i].lang == userLang){
                    langCountry = userLang;
                    langTitle = langsArray[i].title;
                    break;
                }
            }
            arr[0] = langCountry;
            arr[1] = langTitle;
            resolve(arr);
        }).catch(err =>{
            resolve(arr);
            console.error(err);
        });
    });
    return langArr;
}


// app.get("/input", function(req, res){
//     res.setHeader('Content-Type', 'application/json');
//     let text = req.headers.text
//     let userLang = req.headers.lang.toLowerCase();
//     let obj = {};
//     phrasesLoopInput(text, userLang).then(obj =>{
//         res.send(obj);
//     }).catch(err => console.error(err));
// })
// ;
//
// async function phrasesLoopInput(phrase, userLang){
//     var ret = await new Promise(resolve =>{
//         let lang = userLang;
//         let obj = {};
//         wikiInputTerm(phrase, lang).then(wiki =>{
//             if(wiki != undefined){
//                 obj[wiki.englishTitle] = wiki;
//                 resolve(obj);
//             } else{
//                 resolve(obj);
//             }
//         }).catch(err =>{
//             console.error(err);
//         });
//     });
//     return ret;
// }
//
// async function wikiInputTerm(term, userLang){
//     var retWikiTerms = await new Promise(resolve =>{
//         let langCountry;
//         let obj = {};
//         let counter = 0;
//         wiki().search(term, 1).then(searched =>{
//             if(searched.results.length == 0){
//                 resolve(obj);
//             }
//             term = searched.results[0];
//             wiki().page(term).then(page =>{
//                 page.html().then(html =>{
//                     if(html.indexOf("may refer to") != -1){
//                         page.links().then(links =>{
//                             let link = links[0];
//                             let linkArr = [];
//                             for(var i in links){
//                                 if(links[i].toLowerCase().startsWith(term.toLowerCase())){
//                                     linkArr.push(links[i]);
//                                 }
//                                 if(linkArr.length > 1){
//                                     var maxLength = 0;
//                                     var maxJ;
//                                     for(var j in linkArr){
//                                         if(linkArr[j].length > maxLength){
//                                             maxLength = linkArr[j].length;
//                                             maxJ = j;
//                                         }
//                                     }
//                                     link = linkArr[maxJ];
//                                 } else if(linkArr.length == 1){
//                                     link = linkArr[0];
//                                 }
//                             }
//                             wiki().page(link).then(page =>{
//                                 findLang(page, userLang).then(arr =>{ //country,langTitle,englishTitle
//                                     objBuild(arr[0], arr[1], arr[2]).then(obj =>{
//                                         resolve(obj);
//                                     }).catch(err =>{
//                                         console.error(err);
//                                         resolve();
//                                     });
//                                 }).catch(err =>{
//                                     console.error(err);
//                                     resolve();
//                                 });
//                             }).catch(err =>{
//                                 console.error(err);
//                                 resolve();
//                             });
//                         }).catch(err =>{
//                             console.error(err);
//                             resolve();
//                         });
//                     } else{
//                         findLang(page, userLang).then(arr =>{ //country,langTitle,englishTitle
//                             objBuild(arr[0], arr[1], arr[2]).then(obj =>{
//                                 resolve(obj);
//                             }).catch(err =>{
//                                 console.error(err);
//                                 resolve();
//                             });
//                         }).catch(err =>{
//                             console.error(err);
//                             resolve();
//                         });
//                     }
//                 }).catch(err =>{
//                     console.error(err);
//                     resolve();
//                 });
//             }).catch(err =>{
//                 console.error(err);
//                 resolve();
//             });
//         }).catch(err =>{
//             console.error(err);
//             resolve();
//         });
//     });
//     return retWikiTerms;
// }
