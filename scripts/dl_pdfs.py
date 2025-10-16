import xml.etree.ElementTree as ET
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import os

# Parse the XML file
xml_path = 'financial-pdfs/2025FD.xml'
tree = ET.parse(xml_path)
root = tree.getroot()

# Extract DocIDs where FilingType is 'P'
docids = []
for member in root.findall('Member'):
    filing_type_elem = member.find('FilingType')
    if filing_type_elem is not None and filing_type_elem.text == 'P':
        docid_elem = member.find('DocID')
        if docid_elem is not None:
            docids.append(docid_elem.text)

# Set up download directory
download_dir = os.path.join(os.getcwd(), 'pdfs')
os.makedirs(download_dir, exist_ok=True)

# Set up Chrome for headless PDF download
chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_experimental_option("prefs", {
    "download.default_directory": download_dir,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "plugins.always_open_pdf_externally": True
})

driver = webdriver.Chrome(options=chrome_options)

new_downloads = 0
for docid in docids:
    pdf_path = os.path.join(download_dir, f"{docid}.pdf")
    if not os.path.exists(pdf_path):
        url = f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/{docid}.pdf"
        print(f"Downloading new file: {url}")
        driver.get(url)
        time.sleep(3)  # Wait for download
        new_downloads += 1
    else:
        print(f"Already have {docid}.pdf — skipping.")

driver.quit()

print(f"Downloaded {new_downloads} new PDFs to {download_dir}")
