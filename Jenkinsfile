properties([
    // 构建参数：控制目标环境、测试套件、用例过滤和是否显示浏览器。
    parameters([
        // 目标 POS 前端地址，会注入到 Playwright 的 baseURL 配置中。
        string(
            name: 'PLAYWRIGHT_BASE_URL',
            defaultValue: 'http://192.168.0.72:22080',
            description: '(required) Target server URL, e.g. http://IP:PORT'
        ),
        // Git 分支：参数页打开时在现有 workspace 执行 git fetch，并从 origin 远端分支生成选项。
        [
            $class: 'ChoiceParameter',
            choiceType: 'PT_SINGLE_SELECT',
            description: '(required) Git branch to checkout. Loaded dynamically from git fetch origin results.',
            filterLength: 1,
            filterable: false,
            name: 'GIT_BRANCH',
            randomName: 'choice-parameter-git-branch',
            script: [
                $class: 'GroovyScript',
                fallbackScript: [
                    classpath: [],
                    sandbox: true,
                    script: 'return ["main:selected"]'
                ],
                script: [
                    classpath: [],
                    sandbox: false,
                    script: '''
                        try {
                            def workspaceCandidates = []

                            def envWorkspace = System.getenv('WORKSPACE')
                            if (envWorkspace) {
                                workspaceCandidates << envWorkspace
                            }

                            def jenkinsHome = System.getenv('JENKINS_HOME')
                            def jobName = System.getenv('JOB_NAME')
                            if (jenkinsHome && jobName) {
                                workspaceCandidates << new File(jenkinsHome, "workspace/${jobName}").path
                            }

                            workspaceCandidates << 'C:/Users/administrator/Jenkins/.jenkins/workspace/POS2.0 UI'

                            for (workspacePath in workspaceCandidates.unique()) {
                                def workspaceDir = new File(workspacePath)
                                def gitDir = new File(workspaceDir, '.git')
                                if (!workspaceDir.isDirectory() || !gitDir.exists()) {
                                    continue
                                }

                                def fetchCommand = ['cmd', '/c', 'git fetch --prune origin +refs/heads/*:refs/remotes/origin/*']
                                def fetchProcess = fetchCommand.execute(null, workspaceDir)
                                fetchProcess.waitFor()

                                def listCommand = ['cmd', '/c', 'git for-each-ref --format=%(refname:short) refs/remotes/origin']
                                def listProcess = listCommand.execute(null, workspaceDir)
                                def output = new StringBuffer()
                                def errorOutput = new StringBuffer()
                                listProcess.consumeProcessOutput(output, errorOutput)
                                listProcess.waitFor()

                                if (listProcess.exitValue() != 0) {
                                    continue
                                }

                                def branches = output.toString()
                                    .readLines()
                                    .collect { it.trim() }
                                    .findAll { it && it != 'origin/HEAD' }
                                    .collect { it.startsWith('origin/') ? it.substring('origin/'.length()) : it }
                                    .findAll { it }
                                    .unique()
                                    .sort()

                                if (branches) {
                                    if (!branches.contains('main')) {
                                        branches = ['main'] + branches
                                    }
                                    return branches.collect { it == 'main' ? "${it}:selected" : it }
                                }
                            }

                            return ['main:selected']
                        } catch (Throwable error) {
                            return ['main:selected']
                        }
                    '''
                ]
            ]
        ],
        // 动态测试套件：优先读取 Playwright 生成的用例树；缺失时扫描 tests 目录兜底。
        [
            $class: 'CascadeChoiceParameter',
            choiceType: 'PT_SINGLE_SELECT',
            description: '(required) Test suite to run. Loaded dynamically from tests/* directories that contain spec files.',
            filterLength: 1,
            filterable: true,
            name: 'TEST_SUITE',
            randomName: 'choice-parameter-test-suite',
            referencedParameters: 'GIT_BRANCH',
            script: [
                $class: 'GroovyScript',
                fallbackScript: [
                    classpath: [],
                    sandbox: true,
                    script: 'return ["all"]'
                ],
                script: [
                    classpath: [],
                    sandbox: false,
                    script: '''
                        try {
                            def workspaceCandidates = []
                            def selectedBranch = binding.hasVariable('GIT_BRANCH')
                                ? binding.getVariable('GIT_BRANCH')
                                : 'main'
                            selectedBranch = selectedBranch?.toString()?.replace(':selected', '')?.trim() ?: 'main'
                            if (!selectedBranch.matches('[A-Za-z0-9._/-]+')
                                || selectedBranch.startsWith('/')
                                || selectedBranch.endsWith('/')
                                || selectedBranch.contains('..')
                                || selectedBranch.contains('//')
                                || selectedBranch.contains('@{')
                                || selectedBranch.endsWith('.lock')) {
                                return ['all']
                            }

                            def envWorkspace = System.getenv('WORKSPACE')
                            if (envWorkspace) {
                                workspaceCandidates << envWorkspace
                            }

                            def jenkinsHome = System.getenv('JENKINS_HOME')
                            def jobName = System.getenv('JOB_NAME')
                            if (jenkinsHome && jobName) {
                                workspaceCandidates << new File(jenkinsHome, "workspace/${jobName}").path
                            }

                            workspaceCandidates << 'C:/Users/administrator/Jenkins/.jenkins/workspace/POS2.0 UI'

                            def runGit = { File workspaceDir, String command ->
                                def process = ['cmd', '/c', command].execute(null, workspaceDir)
                                def output = new StringBuffer()
                                def errorOutput = new StringBuffer()
                                process.consumeProcessOutput(output, errorOutput)
                                process.waitFor()
                                return process.exitValue() == 0 ? output.toString() : ''
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def workspaceDir = new File(workspacePath)
                                if (!new File(workspaceDir, '.git').exists()) {
                                    continue
                                }

                                runGit(workspaceDir, 'git fetch --prune origin +refs/heads/*:refs/remotes/origin/*')

                                def suitesFromTree = []
                                def remoteTreeText = runGit(workspaceDir, 'git show "origin/' + selectedBranch + ':.jenkins/test-tree.json"')
                                if (remoteTreeText) {
                                    def tree = new groovy.json.JsonSlurperClassic().parseText(remoteTreeText)
                                    if (tree.suites) {
                                        suitesFromTree = tree.suites.collect { it.toString() }.findAll { it != 'all' }
                                    }
                                }

                                def remoteFilesText = runGit(workspaceDir, 'git ls-tree -r --name-only "origin/' + selectedBranch + '" tests')
                                def remoteSuites = remoteFilesText
                                    .readLines()
                                    .collect { it.trim().replace('\\\\', '/') }
                                    .findAll { it.startsWith('tests/') && it.endsWith('.spec.ts') }
                                    .collect { filePath ->
                                        def parts = filePath.split('/')
                                        return parts.length >= 3 ? parts[1] : null
                                    }
                                    .findAll { it }
                                    .unique()
                                    .sort()
                                def mergedSuites = (suitesFromTree + remoteSuites).unique().sort()
                                if (mergedSuites) {
                                    return (['all'] + mergedSuites).unique()
                                }
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def treeFile = new File(workspacePath, '.jenkins/test-tree.json')
                                if (treeFile.isFile()) {
                                    def tree = new groovy.json.JsonSlurperClassic().parseText(treeFile.getText('UTF-8'))
                                    if (tree.suites) {
                                        return tree.suites.collect { it.toString() }
                                    }
                                }
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def testsDir = new File(workspacePath, 'tests')
                                if (!testsDir.isDirectory()) {
                                    continue
                                }

                                def suites = []
                                testsDir.eachFile { suiteDir ->
                                    if (!suiteDir.isDirectory()) {
                                        return
                                    }

                                    def hasSpec = false
                                    suiteDir.eachFileRecurse { testFile ->
                                        if (testFile.isFile() && testFile.name.endsWith('.spec.ts')) {
                                            hasSpec = true
                                        }
                                    }

                                    if (hasSpec) {
                                        suites << suiteDir.name
                                    }
                                }

                                if (!suites.isEmpty()) {
                                    return (['all'] + suites.sort()).unique()
                                }
                            }

                            return ['all']
                        } catch (Throwable error) {
                            return ['all']
                        }
                    '''
                ]
            ]
        ],
        // 动态文件列表：根据 TEST_SUITE 从用例树读取 spec 文件，支持多选后缩小测试范围。
        [
            $class: 'CascadeChoiceParameter',
            choiceType: 'PT_CHECKBOX',
            description: '(optional) Playwright spec file filter. Select one or more files in the selected suite. Leave empty to run all files in the selected suite.',
            filterLength: 1,
            filterable: false,
            name: 'TEST_FILE',
            randomName: 'choice-parameter-test-file',
            referencedParameters: 'GIT_BRANCH,TEST_SUITE',
            script: [
                $class: 'GroovyScript',
                fallbackScript: [
                    classpath: [],
                    sandbox: true,
                    script: '''
                        def activeChoicesError = binding.hasVariable('error') ? binding.getVariable('error') : null
                        return ["TEST_FILE fallback: ${activeChoicesError?.getClass()?.getSimpleName() ?: 'Unknown'}: ${activeChoicesError?.getMessage() ?: 'no error message'}"]
                    '''
                ],
                script: [
                    classpath: [],
                    sandbox: false,
                    script: '''
                        try {
                            def workspaceCandidates = []
                            def selectedSuite = binding.hasVariable('TEST_SUITE')
                                ? binding.getVariable('TEST_SUITE')
                                : 'all'
                            def selectedBranch = binding.hasVariable('GIT_BRANCH')
                                ? binding.getVariable('GIT_BRANCH')
                                : 'main'
                            selectedBranch = selectedBranch?.toString()?.replace(':selected', '')?.trim() ?: 'main'
                            if (!selectedBranch.matches('[A-Za-z0-9._/-]+')
                                || selectedBranch.startsWith('/')
                                || selectedBranch.endsWith('/')
                                || selectedBranch.contains('..')
                                || selectedBranch.contains('//')
                                || selectedBranch.contains('@{')
                                || selectedBranch.endsWith('.lock')) {
                                return []
                            }

                            def envWorkspace = System.getenv('WORKSPACE')
                            if (envWorkspace) {
                                workspaceCandidates << envWorkspace
                            }

                            def jenkinsHome = System.getenv('JENKINS_HOME')
                            def jobName = System.getenv('JOB_NAME')
                            if (jenkinsHome && jobName) {
                                workspaceCandidates << new File(jenkinsHome, "workspace/${jobName}").path
                            }

                            workspaceCandidates << 'C:/Users/administrator/Jenkins/.jenkins/workspace/POS2.0 UI'

                            selectedSuite = selectedSuite ?: 'all'
                            def checkedPaths = []

                            def runGit = { File workspaceDir, String command ->
                                def process = ['cmd', '/c', command].execute(null, workspaceDir)
                                def output = new StringBuffer()
                                def errorOutput = new StringBuffer()
                                process.consumeProcessOutput(output, errorOutput)
                                process.waitFor()
                                return process.exitValue() == 0 ? output.toString() : ''
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def workspaceDir = new File(workspacePath)
                                if (!new File(workspaceDir, '.git').exists()) {
                                    continue
                                }

                                runGit(workspaceDir, 'git fetch --prune origin +refs/heads/*:refs/remotes/origin/*')

                                def filesFromTree = []
                                def remoteTreeText = runGit(workspaceDir, 'git show "origin/' + selectedBranch + ':.jenkins/test-tree.json"')
                                if (remoteTreeText) {
                                    def tree = new groovy.json.JsonSlurperClassic().parseText(remoteTreeText)
                                    def files = tree.files instanceof Map ? tree.files[selectedSuite] : []
                                    if (files) {
                                        filesFromTree = files.collect { it.toString() }
                                    }
                                }

                                def remoteFilesText = runGit(workspaceDir, 'git ls-tree -r --name-only "origin/' + selectedBranch + '" tests')
                                def remoteFiles = remoteFilesText
                                    .readLines()
                                    .collect { it.trim().replace('\\\\', '/') }
                                    .findAll { it.startsWith('tests/') && it.endsWith('.spec.ts') }
                                    .findAll { selectedSuite == 'all' || it.startsWith("tests/${selectedSuite}/") }
                                    .unique()
                                    .sort()
                                def mergedFiles = (filesFromTree + remoteFiles).unique().sort()
                                if (mergedFiles) {
                                    return mergedFiles
                                }
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def treeFile = new File(workspacePath, '.jenkins/test-tree.json')
                                checkedPaths << treeFile.path
                                if (treeFile.isFile()) {
                                    def tree = new groovy.json.JsonSlurperClassic().parseText(treeFile.getText('UTF-8'))
                                    def files = tree.files instanceof Map ? tree.files[selectedSuite] : []
                                    if (files) {
                                        return files.collect { it.toString() }.sort().unique()
                                    }
                                }
                            }

                            def suitePath = selectedSuite == 'all' ? 'tests' : "tests/${selectedSuite}"
                            for (workspacePath in workspaceCandidates.unique()) {
                                def suiteDir = new File(workspacePath, suitePath)
                                checkedPaths << suiteDir.path

                                if (!suiteDir.isDirectory()) {
                                    continue
                                }

                                def files = []
                                suiteDir.eachFileRecurse { specFile ->
                                    if (!specFile.isFile() || !specFile.name.endsWith('.spec.ts')) {
                                        return
                                    }

                                    def relativePath = new File(workspacePath).toPath()
                                        .relativize(specFile.toPath())
                                        .toString()
                                        .replace(File.separator, '/')
                                    files << relativePath
                                }

                                if (!files.isEmpty()) {
                                    return files.sort().unique()
                                }
                            }

                            return ["未找到用例文件: ${checkedPaths.join(' ; ')}"]
                        } catch (Throwable error) {
                            return ["文件加载失败: ${error.getClass().getSimpleName()}: ${error.getMessage()}"]
                        }
                    '''
                ]
            ]
        ],
        // 动态用例列表：根据 TEST_SUITE 和 TEST_FILE 从用例树读取标题，支持多选后传给 Playwright --grep。
        [
            $class: 'CascadeChoiceParameter',
            choiceType: 'PT_CHECKBOX',
            description: '(optional) Playwright test title filter. Select multiple cases for the selected files or suite. Leave empty to run all cases in the selected files or suite.',
            filterLength: 1,
            filterable: false,
            name: 'TEST_CASE_GREP',
            randomName: 'choice-parameter-test-case-grep',
            referencedParameters: 'GIT_BRANCH,TEST_SUITE,TEST_FILE',
            script: [
                $class: 'GroovyScript',
                fallbackScript: [
                    classpath: [],
                    sandbox: true,
                    script: 'return ["Active Choices 脚本执行失败，请检查 In-process Script Approval 或 Jenkins 日志"]'
                ],
                script: [
                    classpath: [],
                    sandbox: false,
                    script: '''
                        try {
                            def workspaceCandidates = []
                            def selectedSuite = binding.hasVariable('TEST_SUITE')
                                ? binding.getVariable('TEST_SUITE')
                                : 'all'
                            def selectedBranch = binding.hasVariable('GIT_BRANCH')
                                ? binding.getVariable('GIT_BRANCH')
                                : 'main'
                            def selectedFilesValue = binding.hasVariable('TEST_FILE')
                                ? binding.getVariable('TEST_FILE')
                                : ''
                            selectedBranch = selectedBranch?.toString()?.replace(':selected', '')?.trim() ?: 'main'
                            if (!selectedBranch.matches('[A-Za-z0-9._/-]+')
                                || selectedBranch.startsWith('/')
                                || selectedBranch.endsWith('/')
                                || selectedBranch.contains('..')
                                || selectedBranch.contains('//')
                                || selectedBranch.contains('@{')
                                || selectedBranch.endsWith('.lock')) {
                                return []
                            }

                            def envWorkspace = System.getenv('WORKSPACE')
                            if (envWorkspace) {
                                workspaceCandidates << envWorkspace
                            }

                            def jenkinsHome = System.getenv('JENKINS_HOME')
                            def jobName = System.getenv('JOB_NAME')
                            if (jenkinsHome && jobName) {
                                workspaceCandidates << new File(jenkinsHome, "workspace/${jobName}").path
                            }

                            workspaceCandidates << 'C:/Users/administrator/Jenkins/.jenkins/workspace/POS2.0 UI'

                            selectedSuite = selectedSuite ?: 'all'
                            def checkedPaths = []
                            def selectedFiles = selectedFilesValue instanceof Collection
                                ? selectedFilesValue.collect { it.toString().trim() }.findAll { it }
                                : selectedFilesValue.toString().split(',').collect { it.trim() }.findAll { it }
                            if (selectedSuite != 'all') {
                                selectedFiles = selectedFiles.findAll { it.startsWith("tests/${selectedSuite}/") }
                            }

                            def runGit = { File workspaceDir, String command ->
                                def process = ['cmd', '/c', command].execute(null, workspaceDir)
                                def output = new StringBuffer()
                                def errorOutput = new StringBuffer()
                                process.consumeProcessOutput(output, errorOutput)
                                process.waitFor()
                                return process.exitValue() == 0 ? output.toString() : ''
                            }
                            def parseCasesFromText = { String specText ->
                                def cases = []
                                def previousLine = ''
                                specText.readLines().each { line ->
                                    def trimmedLine = line.trim()

                                    if (trimmedLine.startsWith("test('") || trimmedLine.startsWith('test("')) {
                                        def titleText = trimmedLine.substring('test('.length()).trim()
                                        def quote = titleText.substring(0, 1)
                                        def endIndex = titleText.indexOf(quote, 1)
                                        if (endIndex > 1) {
                                            cases << titleText.substring(1, endIndex)
                                        }
                                    }

                                    if (previousLine == 'test(' && (trimmedLine.startsWith("'") || trimmedLine.startsWith('"'))) {
                                        def quote = trimmedLine.substring(0, 1)
                                        def endIndex = trimmedLine.indexOf(quote, 1)
                                        if (endIndex > 1) {
                                            cases << trimmedLine.substring(1, endIndex)
                                        }
                                    }

                                    if (trimmedLine.startsWith("title: '") || trimmedLine.startsWith('title: "')) {
                                        def startIndex = trimmedLine.indexOf(':') + 1
                                        def titleText = trimmedLine.substring(startIndex).trim()
                                        def quote = titleText.substring(0, 1)
                                        def endIndex = titleText.indexOf(quote, 1)
                                        if (endIndex > 1) {
                                            cases << titleText.substring(1, endIndex)
                                        }
                                    }

                                    previousLine = trimmedLine
                                }
                                return cases
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def workspaceDir = new File(workspacePath)
                                if (!new File(workspaceDir, '.git').exists()) {
                                    continue
                                }

                                runGit(workspaceDir, 'git fetch --prune origin +refs/heads/*:refs/remotes/origin/*')

                                def cases = []
                                def filesFromTree = []
                                def remoteTreeText = runGit(workspaceDir, 'git show "origin/' + selectedBranch + ':.jenkins/test-tree.json"')
                                if (remoteTreeText) {
                                    def tree = new groovy.json.JsonSlurperClassic().parseText(remoteTreeText)
                                    def files = selectedFiles
                                        ? selectedFiles
                                        : (tree.files instanceof Map ? tree.files[selectedSuite] : [])
                                    filesFromTree = files.collect { it.toString() }
                                    files.each { file ->
                                        def fileCases = tree.cases instanceof Map ? tree.cases[file.toString()] : []
                                        if (fileCases) {
                                            cases.addAll(fileCases.collect { it.toString() })
                                        }
                                    }
                                }

                                def remoteFilesText = runGit(workspaceDir, 'git ls-tree -r --name-only "origin/' + selectedBranch + '" tests')
                                def filesFromRemoteList = remoteFilesText
                                    .readLines()
                                    .collect { it.trim().replace('\\\\', '/') }
                                    .findAll { it.startsWith('tests/') && it.endsWith('.spec.ts') }
                                    .findAll { selectedSuite == 'all' || it.startsWith("tests/${selectedSuite}/") }
                                def remoteFiles = selectedFiles
                                    ? selectedFiles
                                    : (filesFromTree + filesFromRemoteList).unique().sort()
                                remoteFiles.each { file ->
                                    def specText = runGit(workspaceDir, 'git show "origin/' + selectedBranch + ':' + file.toString() + '"')
                                    if (specText) {
                                        cases.addAll(parseCasesFromText(specText))
                                    }
                                }

                                if (!cases.isEmpty()) {
                                    return cases.unique()
                                }
                            }

                            for (workspacePath in workspaceCandidates.unique()) {
                                def treeFile = new File(workspacePath, '.jenkins/test-tree.json')
                                checkedPaths << treeFile.path
                                if (!treeFile.isFile()) {
                                    continue
                                }

                                def tree = new groovy.json.JsonSlurperClassic().parseText(treeFile.getText('UTF-8'))
                                def files = selectedFiles
                                    ? selectedFiles
                                    : (tree.files instanceof Map ? tree.files[selectedSuite] : [])
                                def cases = []
                                files.each { file ->
                                    def fileCases = tree.cases instanceof Map ? tree.cases[file.toString()] : []
                                    if (fileCases) {
                                        cases.addAll(fileCases.collect { it.toString() })
                                    }
                                }

                                if (!cases.isEmpty()) {
                                    return cases.unique()
                                }
                            }

                            def suitePath = selectedSuite == 'all' ? 'tests' : "tests/${selectedSuite}"
                            for (workspacePath in workspaceCandidates.unique()) {
                                def specDir = new File(workspacePath, suitePath)
                                checkedPaths << specDir.path

                                if (!specDir.isDirectory()) {
                                    continue
                                }

                                def cases = []
                                def specFiles = []
                                if (selectedFiles) {
                                    selectedFiles.each { selectedFile ->
                                        def specFile = new File(workspacePath, selectedFile)
                                        checkedPaths << specFile.path
                                        if (specFile.isFile() && specFile.name.endsWith('.spec.ts')) {
                                            specFiles << specFile
                                        }
                                    }
                                } else {
                                    specDir.eachFileRecurse { specFile ->
                                        if (specFile.isFile() && specFile.name.endsWith('.spec.ts')) {
                                            specFiles << specFile
                                        }
                                    }
                                }

                                specFiles.each { specFile ->
                                    if (!specFile.isFile() || !specFile.name.endsWith('.ts')) {
                                        return
                                    }

                                    def previousLine = ''
                                    specFile.readLines('UTF-8').each { line ->
                                        def trimmedLine = line.trim()

                                        if (trimmedLine.startsWith("test('") || trimmedLine.startsWith('test("')) {
                                            def titleText = trimmedLine.substring('test('.length()).trim()
                                            def quote = titleText.substring(0, 1)
                                            def endIndex = titleText.indexOf(quote, 1)
                                            if (endIndex > 1) {
                                                cases << titleText.substring(1, endIndex)
                                            }
                                        }

                                        if (previousLine == 'test(' && (trimmedLine.startsWith("'") || trimmedLine.startsWith('"'))) {
                                            def quote = trimmedLine.substring(0, 1)
                                            def endIndex = trimmedLine.indexOf(quote, 1)
                                            if (endIndex > 1) {
                                                cases << trimmedLine.substring(1, endIndex)
                                            }
                                        }

                                        if (trimmedLine.startsWith("title: '") || trimmedLine.startsWith('title: "')) {
                                            def startIndex = trimmedLine.indexOf(':') + 1
                                            def titleText = trimmedLine.substring(startIndex).trim()
                                            def quote = titleText.substring(0, 1)
                                            def endIndex = titleText.indexOf(quote, 1)
                                            if (endIndex > 1) {
                                                cases << titleText.substring(1, endIndex)
                                            }
                                        }

                                        previousLine = trimmedLine
                                    }
                                }

                                if (!cases.isEmpty()) {
                                    return cases.unique()
                                }
                            }

                            return ["未找到用例目录: ${checkedPaths.join(' ; ')}"]
                        } catch (Throwable error) {
                            return ["用例加载失败: ${error.getClass().getSimpleName()}: ${error.getMessage()}"]
                        }
                    '''
                ]
            ]
        ],
        // 调试开关：勾选后以 headed 模式运行浏览器。
        booleanParam(
            name: 'HEADED',
            defaultValue: false,
            description: '(optional) Run in headed mode (for debugging)'
        )
    ])
])

pipeline {
    // 执行节点：使用任意可用 Jenkins Windows Agent。
    agent any

    // 全局环境变量：Playwright 目标地址、CI 标记和 Node.js 命令路径。
    environment {
        PLAYWRIGHT_BASE_URL = "${params.PLAYWRIGHT_BASE_URL}"
        CI = 'true'
        PATH = "C:\\Program Files\\nodejs;${env.PATH}"
    }

    // 流水线约束：限制总耗时、防止并发构建、保留最近构建记录。
    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        // 拉取代码：确保 workspace 使用当前 Jenkins 构建选中的 Git 版本。
        stage('Checkout') {
            steps {
                script {
                    def selectedBranch = (params.GIT_BRANCH ?: 'main').toString().replace(':selected', '').trim()
                    if (!selectedBranch.matches('[A-Za-z0-9._/-]+')
                        || selectedBranch.startsWith('/')
                        || selectedBranch.endsWith('/')
                        || selectedBranch.contains('..')
                        || selectedBranch.contains('//')
                        || selectedBranch.contains('@{')
                        || selectedBranch.endsWith('.lock')) {
                        error "Invalid GIT_BRANCH value: ${selectedBranch}"
                    }

                    checkout scm
                    bat 'git fetch --prune origin +refs/heads/*:refs/remotes/origin/*'
                    bat "git checkout -B \"${selectedBranch}\" \"origin/${selectedBranch}\""
                    bat 'git rev-parse --abbrev-ref HEAD'
                    bat 'git rev-parse HEAD'
                }
            }
        }

        // 检查运行环境：打印 Node.js 和 npm 版本，便于排查 Agent 环境差异。
        stage('Check Environment') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        // 安装依赖：使用 npm ci 按 lockfile 还原确定版本的依赖。
        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        // 生成用例树：用 Playwright 自己的 --list 结果产出 suite/file/case 联动数据。
        stage('Generate Test Tree') {
            steps {
                bat 'npm run jenkins:test-tree'
            }
        }

        // 清理报告目录：防止 Allure 或 Playwright 读取上一次构建遗留结果。
        stage('Clean Test Reports') {
            steps {
                bat '''
                    if exist "allure-results" rmdir /s /q "allure-results"
                    if exist "allure-report" rmdir /s /q "allure-report"
                    if exist "test-results" rmdir /s /q "test-results"
                '''
            }
        }

        // 运行测试：按动态套件和动态用例标题过滤执行 Playwright。
        stage('Run Tests') {
            steps {
                script {
                    // 解析运行目标：优先使用已选 spec 文件；未选文件时，all 跑全量，其余套件映射到 tests/<suite>。
                    def headedFlag = params.HEADED ? ' --headed' : ''
                    def selectedSuite = params.TEST_SUITE ?: 'all'
                    if (selectedSuite != 'all' && !selectedSuite.matches('[A-Za-z0-9_-]+')) {
                        error "Invalid TEST_SUITE value: ${selectedSuite}"
                    }
                    def selectedFilesValue = params.TEST_FILE ?: ''
                    def selectedFiles = selectedFilesValue instanceof Collection
                        ? selectedFilesValue.collect { it.toString().trim() }.findAll { it }
                        : selectedFilesValue.toString().split('\\s*,\\s*').collect { it.trim() }.findAll { it }
                    for (selectedFile in selectedFiles) {
                        if (!selectedFile.matches('tests/[A-Za-z0-9_./-]+\\.spec\\.ts')) {
                            error "Invalid TEST_FILE value: ${selectedFile}"
                        }
                        if (selectedSuite != 'all' && !selectedFile.startsWith("tests/${selectedSuite}/")) {
                            error "TEST_FILE is outside selected TEST_SUITE: ${selectedFile}"
                        }
                    }
                    def testTarget = selectedFiles
                        ? selectedFiles.join(' ')
                        : (selectedSuite == 'all' ? '' : "tests/${selectedSuite}")

                    // 解析多选用例：Active Choices 多选值可能是集合或逗号分隔字符串。
                    def selectedCases = params.TEST_CASE_GREP ?: ''
                    def selectedCaseText = selectedCases instanceof Collection
                        ? selectedCases.join(',')
                        : selectedCases.toString()
                    def selectedCaseTitles = selectedCaseText
                        .split('\\s*,\\s*')
                        .collect { it.trim() }
                        .findAll { it }

                    // 转义 grep 正则：用例标题按字面量匹配，避免 [POS-xxx] 被当作正则字符类。
                    def regexSpecialChars = '\\^$.*+?()[]{}|'
                    def escapeJsRegexLiteral = { String value ->
                        def escaped = new StringBuilder()
                        for (int index = 0; index < value.length(); index++) {
                            def currentChar = value.charAt(index)
                            if (regexSpecialChars.indexOf(currentChar as int) >= 0) {
                                escaped.append('\\')
                            }
                            escaped.append(currentChar)
                        }
                        return escaped.toString()
                    }

                    // 转义 Windows bat 中文参数：传 ASCII-only 的 Unicode escape，避免 cmd 代码页导致中文乱码。
                    def unicodeEscapeForBatch = { String value ->
                        def escaped = new StringBuilder()
                        for (int index = 0; index < value.length(); index++) {
                            int currentChar = value.charAt(index)
                            if (currentChar < 128) {
                                escaped.append(value.charAt(index))
                            } else {
                                escaped.append('\\').append(String.format('u%04x', currentChar))
                            }
                        }
                        return escaped.toString()
                    }

                    // 生成最终 --grep：多个用例用正则 OR 连接，百分号按 bat 规则转义。
                    def grepValue = selectedCaseTitles
                        .collect { unicodeEscapeForBatch(escapeJsRegexLiteral(it)) }
                        .join('|')
                    def grepFlag = grepValue
                        ? " --grep \"${grepValue.replace('"', '\\"').replace('%', '%%')}\""
                        : ''

                    bat "node node_modules/playwright/cli.js test ${testTarget}${headedFlag}${grepFlag}"
                }
            }
            post {
                always {
                    // 发布 Allure：无论测试成功失败，都基于本次 allure-results 生成报告。
                    allure includeProperties: false,
                           jdk: '',
                           results: [[path: 'allure-results']]
                }
            }
        }
    }

    // 构建后处理：归档原始测试产物，并输出目标环境的成功/失败信息。
    post {
        always {
            // 归档 Playwright trace/video/screenshot 等产物，以及 Allure 原始结果。
            archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
            archiveArtifacts artifacts: 'allure-results/**', allowEmptyArchive: true
        }
        success {
            echo "Tests PASSED. Target: ${params.PLAYWRIGHT_BASE_URL}"
        }
        failure {
            echo "Tests FAILED. Target: ${params.PLAYWRIGHT_BASE_URL}"
        }
    }
}
