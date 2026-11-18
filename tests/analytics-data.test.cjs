const assert = require("node:assert/strict");
const {collect, summarize, videoKeys} = require("../docs/assets/analytics-data.js");

const biliOne = {bvid: "BV1Vu411e7nL", bilibili: "BV1Vu411e7nL", category: "other", date: "2024-01-01"};
const youtube = {youtube: "ELLCf9W2vAo", category: "other", date: "2024-01-01"};
const curated = {bilibili: "BV1Vu411e7nL", bilibiliPage: 1, youtube: "ELLCf9W2vAo", category: "stage", date: "2024-01-01"};
const secondPart = {bilibili: "BV1Vu411e7nL", bilibiliPage: 2, category: "group", date: "2023-05-01"};
const sameTitleOtherVideo = {youtube: "iWx_HxO-oCY", title: "same title", category: "other", date: ""};
const libraries = {
  a: [curated, secondPart, sameTitleOtherVideo],
  b: [biliOne, secondPart],
  home: [biliOne, youtube, sameTitleOtherVideo]
};
const result = collect(["a", "b"], id => libraries[id]);
assert.equal(result.all.length, 3, "linked platforms merge while different parts stay distinct");
assert.equal(result.artists.a.length, 3);
assert.equal(result.artists.b.length, 2, "a shared video may belong to multiple artists");
assert.ok(result.all.some(item => item.category === "stage"), "prefer curated primary category");
assert.notDeepEqual(videoKeys(curated, "x"), videoKeys(secondPart, "y"));
const summary = summarize(result.all, {stage: "舞台", group: "团综", other: "其他"});
assert.equal(summary.categories.reduce((sum, item) => sum + item.value, 0), summary.total);
assert.deepEqual(summary.years.map(item => item.year), ["2023", "2024"]);
assert.equal(summary.years.reduce((sum, item) => sum + item.value, 0), 2, "missing dates are not counted as zero-year");
assert.deepEqual(summarize([], {other: "其他"}), {total: 0, categories: [], years: []});
console.log("analytics data: PASS");
