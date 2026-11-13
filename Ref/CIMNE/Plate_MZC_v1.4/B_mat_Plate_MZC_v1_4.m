function bmat = B_mat_Plate_MZC_v1_4(a,b,x,y)

%% B_Mat Computes the strain-displacement matrix
%
%  Parameters:
%
%    Input, a : Element length in X direction
%           b : Element length in Y direction
%           x : Local X coordinate of the Gauss point
%           y : Local Y coordinate of the Gauss point
%   
%    Output, bmat the strain-displacement matrix

%==================

      d2N(1,1) = 3*( x - x*y )/(4*a^2);
      d2N(2,1) = 3*(-x + x*y )/(4*a^2);
      d2N(3,1) = 3*(-x - x*y )/(4*a^2);
      d2N(4,1) = 3*( x + x*y )/(4*a^2);

      d2N(1,2) = 3*( y - x*y )/(4*b^2);
      d2N(2,2) = 3*( y + x*y )/(4*b^2);
      d2N(3,2) = 3*(-y - x*y )/(4*b^2);
      d2N(4,2) = 3*(-y + x*y )/(4*b^2);

      d2N(1,3) = 2*(  1/2 - 3*x^2/8 - 3*y^2/8)/(a*b);
      d2N(2,3) = 2*( -1/2 + 3*x^2/8 + 3*y^2/8)/(a*b);
      d2N(3,3) = 2*(  1/2 - 3*x^2/8 - 3*y^2/8)/(a*b);
      d2N(4,3) = 2*( -1/2 + 3*x^2/8 + 3*y^2/8)/(a*b);

%==================

      d2NN(1,1) = ( (3*a*x - 3*a*x*y - a + a*y)/4 )/a^2;
      d2NN(2,1) = ( (3*a*x - 3*a*x*y + a - a*y)/4 )/a^2;
      d2NN(3,1) = ( (3*a*x + 3*a*x*y + a + a*y)/4 )/a^2;
      d2NN(4,1) = ( (3*a*x + 3*a*x*y - a - a*y)/4 )/a^2;

      d2NN(1,2) = 0;
      d2NN(2,2) = 0;
      d2NN(3,2) = 0;
      d2NN(4,2) = 0;

      d2NN(1,3) = 2*( -3/8*a*x^2 + a*x/4 + a/8 )/(a*b);
      d2NN(2,3) = 2*( -3/8*a*x^2 - a*x/4 + a/8 )/(a*b);
      d2NN(3,3) = 2*(  3/8*a*x^2 + a*x/4 - a/8 )/(a*b);
      d2NN(4,3) = 2*(  3/8*a*x^2 - a*x/4 - a/8 )/(a*b);

%==================

      d2NNN(1,1) = 0;
      d2NNN(2,1) = 0;
      d2NNN(3,1) = 0;
      d2NNN(4,1) = 0;

      d2NNN(1,2) = ( (3*b*y - 3*b*x*y - b + b*x)/4 )/b^2;
      d2NNN(2,2) = ( (3*b*y + 3*b*x*y - b - b*x)/4 )/b^2;
      d2NNN(3,2) = ( (3*b*y + 3*b*x*y + b + b*x)/4 )/b^2;
      d2NNN(4,2) = ( (3*b*y - 3*b*x*y + b - b*x)/4 )/b^2;

      d2NNN(1,3) = 2*( -3/8*b*y^2 + b*y/4 + b/8 )/(a*b);
      d2NNN(2,3) = 2*(  3/8*b*y^2 - b*y/4 - b/8 )/(a*b);
      d2NNN(3,3) = 2*(  3/8*b*y^2 + b*y/4 - b/8 )/(a*b);
      d2NNN(4,3) = 2*( -3/8*b*y^2 - b*y/4 + b/8 )/(a*b);

%==================

      bmat_1  = [ -d2N(1,1),-d2NN(1,1),-d2NNN(1,1) ;
                  -d2N(1,2),-d2NN(1,2),-d2NNN(1,2) ;
                  -d2N(1,3),-d2NN(1,3),-d2NNN(1,3)] ;
 
      bmat_2  = [ -d2N(2,1),-d2NN(2,1),-d2NNN(2,1) ;
                  -d2N(2,2),-d2NN(2,2),-d2NNN(2,2) ;
                  -d2N(2,3),-d2NN(2,3),-d2NNN(2,3)] ;

      bmat_3  = [ -d2N(3,1),-d2NN(3,1),-d2NNN(3,1) ;
                  -d2N(3,2),-d2NN(3,2),-d2NNN(3,2) ;
                  -d2N(3,3),-d2NN(3,3),-d2NNN(3,3)] ;

      bmat_4  = [ -d2N(4,1),-d2NN(4,1),-d2NNN(4,1) ;
                  -d2N(4,2),-d2NN(4,2),-d2NNN(4,2) ;
                  -d2N(4,3),-d2NN(4,3),-d2NNN(4,3)] ;
 
      bmat = [bmat_1,bmat_2,bmat_3,bmat_4];

