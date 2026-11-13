function plot_mesh(type,gcoord,nodes,nel)
%--------------------------------------------------------------------------
%                                 FEM Q4
%--------------------------------------------------------------------------

if type == 'Q4'
    figure('color',[1 1 1])
    hold on
    for i=1:nel
        xgcoord=gcoord(nodes(i,:),1);
        ygcoord=gcoord(nodes(i,:),2);
        xcen=sum(xgcoord)/4;
        ycen=sum(ygcoord)/4;
        XX=[xgcoord' xgcoord(1)];
        YY=[ygcoord' ygcoord(1)];
        hold on
        plot(XX,YY)
        text(xcen,ycen,int2str(i),'fontsize',8)
    end
    for i=1:length(gcoord)
        text(gcoord(i,1),gcoord(i,2),int2str(i),'fontsize',8)
    end
    axis image
    axis off
end
%--------------------------------------------------------------------------
%                                 FEM T3
%--------------------------------------------------------------------------

if type == 'T3'
    figure('color',[1 1 1])
    hold on
    for i=1:length(nodes)
        xx=gcoord(nodes(i,:),1);yy=gcoord(nodes(i,:),2);
        cenx=sum(xx)/3; ceny=sum(yy)/3;
        x = [xx' xx(1)]; y = [yy' yy(1)];
        plot(x,y,'b')
        h=text(cenx,ceny,int2str(i));
        set(h,'fontsize',8,'color','b');
    end
    for i=1:length(gcoord)
        h=text(gcoord(i,1),gcoord(i,2),int2str(i));
        set(h,'fontsize',8,'color','k');
    end
    axis off
    axis image
end