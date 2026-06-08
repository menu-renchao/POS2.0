properties([
    parameters([
        string(
            name: 'PLAYWRIGHT_BASE_URL',
            defaultValue: 'http://192.168.0.72:22080',
            description: 'Target server URL, e.g. http://IP:PORT'
        ),
        choice(
            name: 'TEST_SUITE',
            choices: ['all', 'smoke', 'e2e', 'py-migrate'],
            description: 'Test suite to run'
        ),
        string(
            name: 'TEST_CASE_SOURCE_DIR',
            defaultValue: 'C:/Users/administrator/Jenkins/.jenkins/workspace/POS2.0 UI',
            description: 'Directory that contains the checked-out repo for loading test case choices.'
        ),
        [
            $class: 'CascadeChoiceParameter',
            choiceType: 'PT_CHECKBOX',
            description: 'Optional Playwright test title filter. Select multiple cases for the selected suite.',
            filterLength: 1,
            filterable: true,
            name: 'TEST_CASE_GREP',
            randomName: 'choice-parameter-test-case-grep',
            referencedParameters: 'TEST_SUITE,TEST_CASE_SOURCE_DIR',
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
                        def selectedSourceDir = binding.hasVariable('TEST_CASE_SOURCE_DIR')
                            ? binding.getVariable('TEST_CASE_SOURCE_DIR')
                            : ''
                        def selectedSuite = binding.hasVariable('TEST_SUITE')
                            ? binding.getVariable('TEST_SUITE')
                            : 'all'

                        if (selectedSourceDir) {
                            workspaceCandidates << selectedSourceDir
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
                        workspaceCandidates << 'D:/menusifu/pos2.0'

                        selectedSuite = selectedSuite ?: 'all'
                        def suitePathByName = [
                            'smoke': 'tests/smoke',
                            'e2e': 'tests/e2e',
                            'py-migrate': 'tests/py-migrate',
                            'all': 'tests'
                        ]
                        def suitePath = suitePathByName[selectedSuite] ?: 'tests'
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

        stage('Run Tests') {
            steps {
                script {
                    def headedFlag = params.HEADED ? ' --headed' : ''
                    def testTarget

                    switch (params.TEST_SUITE) {
                        case 'smoke':
                            testTarget = 'tests/smoke'
                            break
                        case 'e2e':
                            testTarget = 'tests/e2e'
                            break
                        case 'py-migrate':
                            testTarget = 'tests/py-migrate'
                            break
                        default:
                            testTarget = ''
                    }

                    def selectedCases = params.TEST_CASE_GREP ?: ''
                    def grepValue = selectedCases.toString().trim().replaceAll('\\s*,\\s*', '|')
                    def grepFlag = grepValue
                        ? " --grep \"${grepValue.replace('"', '\\"')}\""
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
