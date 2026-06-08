pipeline {
    agent any

    parameters {
        string(
            name: 'PLAYWRIGHT_BASE_URL',
            defaultValue: 'http://192.168.0.72:22080',
            description: 'Target server URL, e.g. http://IP:PORT'
        )
        choice(
            name: 'TEST_SUITE',
            choices: ['all', 'smoke', 'e2e', 'py-migrate'],
            description: 'Test suite to run'
        )
        string(
            name: 'TEST_CASE_GREP',
            defaultValue: '',
            description: 'Optional Playwright test title regex. Use | to run multiple cases, e.g. 用例A|用例B'
        )
        booleanParam(
            name: 'HEADED',
            defaultValue: false,
            description: 'Run in headed mode (for debugging)'
        )
    }

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

                    def grepFlag = params.TEST_CASE_GREP?.trim()
                        ? " --grep \"${params.TEST_CASE_GREP.trim().replace('"', '\\"')}\""
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
