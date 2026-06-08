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
        [
            $class: 'CascadeChoiceParameter',
            choiceType: 'PT_CHECKBOX',
            description: 'Optional Playwright test title filter. Select multiple cases for py-migrate.',
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
                    script: 'return []'
                ],
                script: [
                    classpath: [],
                    sandbox: false,
                    script: '''
                        if (TEST_SUITE != 'py-migrate') {
                            return []
                        }

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

                        def literalTestTitlePattern = ~/(?m)^\\s*test\\(\\s*(?:\\r?\\n\\s*)['"]([^'"]+)['"]/
                        def caseTitlePattern = ~/(?m)^\\s*title:\\s*['"]([^'"]+)['"]/

                        for (workspacePath in workspaceCandidates.unique()) {
                            def specDir = new File(workspacePath, 'tests/py-migrate')

                            if (!specDir.isDirectory()) {
                                continue
                            }

                            def cases = []
                            specDir.eachFileMatch(~/.*\\.spec\\.ts/) { specFile ->
                                def specContent = specFile.getText('UTF-8')

                                def literalTitleMatcher = specContent =~ literalTestTitlePattern
                                literalTitleMatcher.each { match ->
                                    cases << match[1]
                                }

                                def caseTitleMatcher = specContent =~ caseTitlePattern
                                caseTitleMatcher.each { match ->
                                    cases << match[1]
                                }
                            }

                            if (!cases.isEmpty()) {
                                return cases.unique()
                            }
                        }

                        return []
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
