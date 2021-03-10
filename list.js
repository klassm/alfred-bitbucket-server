#!/usr/local/bin/node
const process = require("process");
const _ = require("lodash");
const alfy = require("alfy");
const axios = require("axios");

const bitbucketUrl = alfy.config.get("bitbucketUrl");
const bitbucketUsername = alfy.config.get("bitbucketUsername");
const bitbucketPassword = alfy.config.get("bitbucketPassword");

if (!bitbucketUrl || !bitbucketUsername || !bitbucketPassword) {
  alfy.error("Please set all bitbucket data before trying to query bitbucket.")
  process.exit(1);
}

async function loadRepositoryPage(start = 0) {
  const result = await axios.get(`${bitbucketUrl}/rest/api/1.0/repos?limit=1000&start=${start}`, {
    auth: {
      username: bitbucketUsername,
      password: bitbucketPassword
    }
  });
  return result.data;
}

async function loadAllRepositories() {
  let start = 0;
  let results = [];
  let isLastPage = false;
  while(!isLastPage) {
    const page = await loadRepositoryPage(start)
    isLastPage = page.isLastPage;
    start = page.nextPageStart;
    results = [...results, ...page.values];
  }
  return results;
}

async function getAllRepositories() {
  const cacheKey = "bitbucketRepositories";
  const repositories = alfy.cache.get(cacheKey);
  if (repositories && repositories.length > 0) {
    return repositories;
  }
  const newRepositories = await loadAllRepositories();
  alfy.cache.set(cacheKey, newRepositories, {maxAge: 1000 * 60 * 60 * 5});
  return newRepositories;
}


function matchOptionsFor(option) {
  const optionParts = option?.toLowerCase().replace(/[^a-z]/, "")?.split(" ") ?? [];
  return optionParts.flatMap(part => {
    const subParts = part.split(/[-_]/g);
    const acronym = subParts.length >= 3
        ? subParts.map(part => part.charAt(0)).join("")
        : undefined;
    return [
      part, acronym, ...subParts
    ].filter(it => it).filter(it => it.length > 2);
  })
}

function toAlfred(option) {
  return {
    uid: `${option.projectKey}_${option.slug}`.toLowerCase().replace(/[^a-z]/, ""),
    title: option.name,
    subtitle: option.projectName,
    arg: option.link,
    autocomplete: option,
    match: option.searchData.join(" ")
  }
}

function mapRepository(repository) {
  const information = {
    name: repository.name,
    slug: repository.slug,
    projectKey: repository.project?.key ?? "",
    projectName: repository.project?.name ?? "",
    link: repository.links?.self[0].href
  };

  const searchData = _.uniq([information.name, information.slug, information.projectKey].flatMap(matchOptionsFor))

  return {...information, searchData}
}

async function listAllForAlfred() {
  const repositories = await getAllRepositories();
  const options = repositories
      .map(mapRepository)
      .map(toAlfred);
  console.log(JSON.stringify({items: options}));
}

void listAllForAlfred();
