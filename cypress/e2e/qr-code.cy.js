describe('QR Code Display', () => {
  it('displays QR code element on event page', () => {
    cy.mockEventPage()

    // Assert QR code container exists
    cy.getByTestId('qr-code').should('exist')

    // Assert an SVG element exists within the QR code container
    cy.getByTestId('qr-code').find('svg').should('exist')
  })

  it('displays share link matching event URL', () => {
    cy.mockEventPage()

    // The share link input should contain the event URL with the test-uuid
    cy.getByTestId('share-link-input')
      .should('be.visible')
      .invoke('val')
      .should('include', '/event/test-uuid')
  })

  it('has a copy button for the share link', () => {
    cy.mockEventPage()

    cy.getByTestId('share-copy-btn').should('exist').should('be.visible')
  })
})
