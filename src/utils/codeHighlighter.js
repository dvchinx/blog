// PrismLight con solo los lenguajes que usan los posts (el build completo de
// Prism trae cientos). Compartido por PostView y el prerender para que ambos
// resalten igual. Para un lenguaje nuevo: importarlo y añadirlo a LANGUAGES.
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light.js'
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus.js'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash.js'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp.js'
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker.js'
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql.js'
import groovy from 'react-syntax-highlighter/dist/esm/languages/prism/groovy.js'
import http from 'react-syntax-highlighter/dist/esm/languages/prism/http.js'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java.js'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript.js'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json.js'
import lua from 'react-syntax-highlighter/dist/esm/languages/prism/lua.js'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup.js'
import nginx from 'react-syntax-highlighter/dist/esm/languages/prism/nginx.js'
import properties from 'react-syntax-highlighter/dist/esm/languages/prism/properties.js'
import protobuf from 'react-syntax-highlighter/dist/esm/languages/prism/protobuf.js'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python.js'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql.js'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml.js'
import { detectCodeLanguage } from './detectCodeLanguage.js'

const LANGUAGES = {
  bash, cpp, docker, graphql, groovy, http, java, javascript, json, lua,
  markup, nginx, properties, protobuf, python, sql, yaml
}

// Nombres usados en los bloques ``` que Prism registra con otro nombre
const ALIASES = {
  dockerfile: 'docker',
  html: 'markup',
  js: 'javascript',
  jsx: 'javascript',
  proto: 'protobuf',
  sh: 'bash',
  shell: 'bash',
  xml: 'markup',
  yml: 'yaml'
}

for (const [name, language] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, language)
}

// Lenguaje del bloque: la pista ```lang si existe, si no la heurística.
// Un lenguaje no registrado se muestra como texto plano.
export function resolveCodeLanguage(className, code) {
  const hint = /language-([\w-]+)/.exec(className || '')?.[1]?.toLowerCase()
  const language = hint || detectCodeLanguage(code)
  return ALIASES[language] || language
}

export { SyntaxHighlighter, vscDarkPlus }
