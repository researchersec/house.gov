import xml.etree.ElementTree as ET
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import os

# Parse the XML file
tree = ET.parse('financial-pdfs/2025FD.xml')
root = tree.getroot()

# Extract DocIDs where FilingType is 'P'
docids = []
for member in root.findall('Member'):
    filing_type_elem = member.find('FilingType')
    if filing_type_elem is not None and filing_type_elem.text == 'P':
        docid_elem = member.find('DocID')
        if docid_elem is not None:
            docids.append(docid_elem.text)

# Set up download directory (change this to your desired path)
download_dir = os.path.join(os.getcwd(), 'pdf_downloads')
if not os.path.exists(download_dir):
    os.makedirs(download_dir)

# Set up Chrome options for automatic PDF download
chrome_options = Options()
chrome_options.add_experimental_option("prefs", {
    "download.default_directory": download_dir,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "plugins.always_open_pdf_externally": True
})

# Initialize WebDriver (assumes chromedriver is in PATH)
driver = webdriver.Chrome(options=chrome_options)

# Download each PDF
for docid in docids:
    url = f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/{docid}.pdf"
    driver.get(url)
    time.sleep(3)  # Wait for download to complete (adjust if needed)

# Clean up
driver.quit()

print(f"Downloaded {len(docids)} PDFs to {download_dir}")
