properties([
    parameters([
        string(
            name: 'PLAYWRIGHT_BASE_URL',
            defaultValue: 'http://192.168.0.72:22080',
            description: 'Target server URL, e.g. http://IP:PORT'
        ),
        [
            $class: 'ChoiceParameter',
            choiceType: 'PT_SINGLE_SELECT',
            description: 'Test suite to run. Loaded dynamically from tests/* directories that contain spec files.',
            filterLength: 1,
            filterable: false,
            name: 'TEST_SUITE',
            randomName: 'choice-parameter-test-suite',
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
                        workspaceCandidates << 'D:/menusifu/pos2.0'

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
        [
            $class: 'CascadeChoiceParameter',
            choiceType: 'PT_CHECKBOX',
            description: 'Optional Playwright test title filter. Select multiple cases for the selected suite.',
            filterLength: 1,
            filterable: true,
            name: 'TEST_CASE_GREP',
            randomName: 'choice-parameter-test-case-grep',
            referencedParameters: 'TEST_SUITE',
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
                        workspaceCandidates << 'D:/menusifu/pos2.0'

                        selectedSuite = selectedSuite ?: 'all'
                        def suitePath = selectedSuite == 'all' ? 'tests' : "tests/${selectedSuite}"
                        def checkedPaths = []

                        for (workspacePath in workspaceCandidates.unique()) {
                            def specDir = new File(workspacePath, suitePath)
                            checkedPaths << specDir.path

                            if (!specDir.isDirectory()) {
                                continue
                            }

                            def cases = []
                            specDir.eachFileRecurse { specFile ->
                                if (!specFile.isFile() || !specFile.name.endsWith('.ts')) {
                                    return
                                }

                                def previousLine = ''
                                specFile.eachLine('UTF-8') { line ->
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
        booleanParam(
            name: 'HEADED',
            defaultValue: false,
            description: 'Run in headed mode (for debugging)'
        )
    ])
])

pipeline {
    agent any

    environment {
        PLAYWRIGHT_BASE_URL = "${params.PLAYWRIGHT_BASE_URL}"
        CI = 'true'
        PATH = "C:\\Program Files\\nodejs;${env.PATH}"
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Environment') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Clean Test Reports') {
            steps {
                bat '''
                    if exist "allure-results" rmdir /s /q "allure-results"
                    if exist "allure-report" rmdir /s /q "allure-report"
                    if exist "test-results" rmdir /s /q "test-results"
                '''
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    def headedFlag = params.HEADED ? ' --headed' : ''
                    def selectedSuite = params.TEST_SUITE ?: 'all'
                    if (selectedSuite != 'all' && !selectedSuite.matches('[A-Za-z0-9_-]+')) {
                        error "Invalid TEST_SUITE value: ${selectedSuite}"
                    }
                    def testTarget = selectedSuite == 'all' ? '' : "tests/${selectedSuite}"

                    def selectedCases = params.TEST_CASE_GREP ?: ''
                    def selectedCaseText = selectedCases instanceof Collection
                        ? selectedCases.join(',')
                        : selectedCases.toString()
                    def selectedCaseTitles = selectedCaseText
                        .split('\\s*,\\s*')
                        .collect { it.trim() }
                        .findAll { it }
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
                    allure includeProperties: false,
                           jdk: '',
                           results: [[path: 'allure-results']]
                }
            }
        }
    }

    post {
        always {
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
