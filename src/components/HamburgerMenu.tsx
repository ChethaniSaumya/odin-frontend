import React, { useState } from 'react';

const HamburgerMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={toggleMenu}
                className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                aria-label="Menu"
            >
                <div className="w-6 h-5 flex flex-col justify-between">
                    <span className={`block h-0.5 w-full bg-white transition-transform ${isOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                    <span className={`block h-0.5 w-full bg-white transition-opacity ${isOpen ? 'opacity-0' : ''}`}></span>
                    <span className={`block h-0.5 w-full bg-white transition-transform ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                </div>
            </button>

            {/* Menu Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={toggleMenu}
                />
            )}

            {/* Menu Panel */}
            <div className={`fixed top-0 right-0 h-full w-64 bg-gray-900 shadow-xl z-40 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-8 mt-16">
                    <nav className="space-y-4">

                        <a href="https://theninerealms.world/"
                            className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg transition-colors text-lg"
                        >
                            🏠 Main Site
                        </a>

                        <a href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                toggleMenu();
                                document.getElementById('mint-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="block px-4 py-3 text-white hover:bg-gray-800 rounded-lg transition-colors text-lg"
                        >
                            🎨 Mint NFT
                        </a>

                    </nav>
                </div>
            </div>
        </>
    );
};

export default HamburgerMenu;