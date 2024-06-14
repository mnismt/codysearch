import * as vscode from 'vscode'
import * as https from 'https'
import tmp from 'tmp'
import * as fs from 'fs'

/**
 * Performs a web search using the Jina AI search engine and displays the results in a Cody AI mention.
 *
 * This function prompts the user to enter a search query, then makes an HTTPS GET request to the Jina AI search engine with the encoded query. The response data is then passed to the `appendToChat` function, which creates a temporary file with the query and result, and opens the file in a Cody AI mention.
 *
 * @returns {Promise<void>} A Promise that resolves when the search is complete or an error occurs.
 */
export async function webSearch(): Promise<void> {
  // Get the extension ID.
  const extensionID = 'sourcegraph.cody-ai'

  // Get the extension.
  const extension = vscode.extensions.getExtension(extensionID)

  // If the extension is not installed, return.
  if (!extension) {
    // Show a warning to the user that the extension is not active or installed
    vscode.window.showWarningMessage('Cody AI extension is not active or installed')
    return
  }

  // Prompt the user to input a search query
  vscode.window
    .showInputBox({
      prompt: 'Enter your web search query',
      placeHolder: 'Type your search query here'
    })
    .then(query => {
      // If the user cancels the input, return.
      if (!query) {
        return
      }
      const encodedQuery = encodeURIComponent(query)
      const url = `https://s.jina.ai/${encodedQuery}`

      // Create a status bar item for the progress indicator
      const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
      statusBarItem.text = 'Gathering the web result... 0%'
      statusBarItem.show()

      // Update the progress every second
      let progress = 0
      const progressInterval = setInterval(() => {
        progress += 10
        statusBarItem.text = `Gathering the web result... ${progress}%`
      }, 1000)

      https
        .get(url, response => {
          let data = ''
          response.setEncoding('utf8')

          response.on('data', chunk => {
            data += chunk
          })

          response.on('end', () => {
            // Clear the progress interval and hide the status bar item
            clearInterval(progressInterval)
            statusBarItem.hide()
            statusBarItem.dispose()

            // Show the data in a new webview
            displaySearchResultsInMention(query, data)
          })
        })
        .on('error', () => {
          // Clear the progress interval and hide the status bar item
          clearInterval(progressInterval)
          statusBarItem.hide()
          statusBarItem.dispose()

          vscode.window.showErrorMessage('An error occurred while making the HTTP request.')
        })
    })
}

/**
 * Appends a summary of the web search query and result to a temporary file, and opens the file in a Cody AI mention.
 *
 * @param query - The original search query entered by the user.
 * @param message - The result of the web search.
 */
async function displaySearchResultsInMention(query: string, message: string) {
  // create a temporary in-memory file with the content of 'message' in the project root directory to be called with the vscode.URL for the 'cody.mention.file' command
  const content = `Your goal is to summarize the result based on the users query and additional context if provided. !!Strictly append the URL Source as citations to the summary as ground truth!!\n\nThis is the users query:${query}\n\nThis is the result of the query:${message}`
  try {
    //const path = vscode.Uri.file('/tmp');
    //const file = vscode.Uri.joinPath(path, 'query.txt');

    const tmpFile = tmp.fileSync({ postfix: '.txt', name: query })
    const tmpFileUri = vscode.Uri.file(tmpFile.name)

    fs.writeFileSync(tmpFile.name, content)
    await vscode.commands.executeCommand('cody.mention.file', tmpFileUri)

    // Cleanup the temporary file
    tmpFile.removeCallback()
  } catch (err) {
    console.error(err)
  }
}
