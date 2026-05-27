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
                bat 'npx playwright install chromium --with-deps'
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    def headedFlag = params.HEADED ? ' --headed' : ''
                    def testCmd

                    switch (params.TEST_SUITE) {
                        case 'smoke':
                            testCmd = "npm run test:smoke${headedFlag}"
                            break
                        case 'e2e':
                            testCmd = "npm run test:e2e${headedFlag}"
                            break
                        case 'py-migrate':
                            testCmd = "npm run test:py-migrate${headedFlag}"
                            break
                        default:
                            testCmd = "npm test${headedFlag}"
                    }

                    bat testCmd
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
